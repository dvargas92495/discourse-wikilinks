import { withPluginApi } from "discourse/lib/plugin-api";
import { searchForTerm } from "discourse/lib/search";
import { h } from "virtual-dom";
import { Promise } from "rsvp";
import { ajax } from "discourse/lib/ajax";

const POPOVER_ID = "wikilinks-popover";
const REGEX = /\[\[([^\]]+)\]\]/;

function originalPostLinksHtml(attrs, state) {
  if (!this.attrs.links || this.attrs.links.length === 0) {
    // shortcut all work
    return;
  }

  // only show incoming
  const links = this.attrs.links.filter((l) => l.reflection).uniqBy("title");

  if (links.length === 0) {
    return;
  }

  const result = [];

  // show all links
  if (links.length <= 5 || !state.collapsed) {
    links.forEach((l) => result.push(this.linkHtml(l)));
  } else {
    const max = Math.min(5, links.length);
    for (let i = 0; i < max; i++) {
      result.push(this.linkHtml(links[i]));
    }
    // 'show more' link
    if (links.length > max) {
      result.push(
        h(
          "li",
          this.attach("link", {
            labelCount: "post_links.title",
            title: "post_links.about",
            count: links.length - max,
            action: "expandLinks",
            className: "expand-links",
          })
        )
      );
    }
  }

  if (result.length) {
    return h("ul.post-links", result);
  }
}

const getCoordsFromTextarea = (t) => {
  const properties = [
    "direction",
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
  ];

  const div = document.createElement("div");
  div.id = "input-textarea-caret-position-mirror-div";
  document.body.appendChild(div);

  const style = div.style;
  const computed = getComputedStyle(t);

  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";

  // position off-screen
  style.position = "absolute";
  style.visibility = "hidden";
  style.overflow = "hidden";

  // transfer the element's properties to the div
  properties.forEach((prop) => {
    style[prop] = computed[prop];
  });

  div.textContent = t.value.substring(0, t.selectionStart);

  const span = document.createElement("span");
  span.textContent = t.value.substring(t.selectionStart) || ".";
  div.appendChild(span);

  const doc = document.documentElement;
  const windowLeft =
    (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
  const windowTop =
    (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);

  const coordinates = {
    top:
      windowTop +
      span.offsetTop +
      parseInt(computed.borderTopWidth, 10) +
      parseInt(computed.fontSize, 10) -
      t.scrollTop -
      9,
    left:
      windowLeft + span.offsetLeft + parseInt(computed.borderLeftWidth, 10) - 1,
  };
  document.body.removeChild(div);
  return coordinates;
};

const initializeWikilinks = (api) => {
  let posts = [];
  document.addEventListener("input", (e) => {
    const { target } = e;
    if (
      target.nodeName === "TEXTAREA" &&
      target.classList.contains("ember-text-area")
    ) {
      const { selectionStart, selectionEnd, value } = target;
      if (e.data === "[") {
        if (value.endsWith("[[")) {
          target.value = `${target.value}]]`;
          target.setSelectionRange(selectionStart, selectionEnd);
        }
      } else {
        const precursor = value.slice(0, selectionStart);
        const postcursor = value.slice(selectionStart);
        if (/^[^[]*\]\]/.test(postcursor) && /\[\[[^\]]+$/.test(precursor)) {
          const popover = document.getElementById(POPOVER_ID);
          const firstHalfTerm = /\[\[([^[\]]+)$/.exec(precursor)?.[1];
          const secondHalfTerm = /^([^[\]]*)\]\]/.exec(postcursor)?.[1];
          const term = `${firstHalfTerm}${secondHalfTerm}`;
          const loadItems = (container) =>
            searchForTerm(term).then((results) => {
              posts = results.posts;
              if (results.posts.length > 0) {
                container.parentElement.style.borderWidth = "1px";
              }
              return results.posts.forEach((post) => {
                const item = document.createElement("li");
                item.onclick = () => {
                  const valueWithLink = `${precursor.slice(
                    0,
                    -firstHalfTerm.length - 2
                  )}[[${post.topic.fancy_title}]]`;
                  target.value = `${valueWithLink}${postcursor.slice(
                    secondHalfTerm.length + 2
                  )}`;
                  target.focus();
                  target.setSelectionRange(
                    valueWithLink.length,
                    valueWithLink.length
                  );
                };

                const anchor = document.createElement("a");
                anchor.className = "selected";
                item.appendChild(anchor);

                const img = document.createElement("img");
                img.loading = "lazy";
                img.width = "20";
                img.height = "20";
                img.src = post.avatar_template;
                img.className = "avatar";
                img.title = post.topic.fancy_title;
                img.ariaLabel = post.topic.fancy_title;
                anchor.appendChild(img);

                const username = document.createElement("span");
                username.innerText = post.topic.fancy_title;
                username.className = "username";
                anchor.appendChild(username);

                const name = document.createElement("span");
                name.innerText = post.topic.tags.join(",");
                name.className = "name";
                anchor.appendChild(name);

                container.appendChild(item);
              });
            });
          if (popover) {
            const container = popover.querySelector("ul");
            Array.from(container.children).forEach((n) => n.remove());
            loadItems(container);
          } else {
            const popoverRef = document.createElement("div");
            popoverRef.id = POPOVER_ID;
            popoverRef.className = "autocomplete ac-user";
            const { top, left } = getCoordsFromTextarea(target);
            popoverRef.style.left = top + "px";
            popoverRef.style.top = left + "px";
            popoverRef.style.position = "absolute";
            popoverRef.style.borderWidth = "0";

            const style = document.createElement("style");
            style.innerHTML = `#${POPOVER_ID}.autocomplete ul li a.wikilinks-selected {
            background-color: var(--highlight-low);
          }`;
            popoverRef.appendChild(style);

            const list = document.createElement("ul");
            popoverRef.appendChild(list);

            loadItems(list);

            target.parentElement.appendChild(popoverRef);
            document.addEventListener(
              "click",
              () => {
                popoverRef.remove();
                posts = [];
              },
              {
                once: true,
              }
            );
          }
        }
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    const goUp = e.key === "ArrowUp";
    const goDown = e.key === "ArrowDown";
    const goLeft = e.key === "ArrowLeft";
    const goRight = e.key === "ArrowRight";
    const entered = e.key === "Enter";
    if (goUp || goDown) {
      const { target } = e;
      if (
        target.nodeName === "TEXTAREA" &&
        target.classList.contains("ember-text-area")
      ) {
        const popover = document.getElementById(POPOVER_ID);
        if (popover) {
          const options = popover.querySelector("ul").children;
          const selectedIndex = Array.from(options).findIndex((c) =>
            c.firstChild.classList.contains("wikilinks-selected")
          );
          const newIndex = goUp
            ? selectedIndex <= 0
              ? options.length - 1
              : selectedIndex - 1
            : (selectedIndex + 1) % options.length;
          if (selectedIndex >= 0) {
            options[selectedIndex].firstChild.classList.remove(
              "wikilinks-selected"
            );
          }
          options[newIndex].firstChild.classList.add("wikilinks-selected");
          e.preventDefault();
          e.stopPropagation();
        }
      }
    } else if (entered) {
      const { target } = e;
      if (
        target.nodeName === "TEXTAREA" &&
        target.classList.contains("ember-text-area")
      ) {
        const popover = document.getElementById(POPOVER_ID);
        if (popover) {
          const options = popover.querySelector("ul").children;
          const selectedIndex = Array.from(options).findIndex((c) =>
            c.firstChild.classList.contains("wikilinks-selected")
          );
          const post = posts[selectedIndex];

          const { selectionStart, value } = target;
          const precursor = value.slice(0, selectionStart);
          const postcursor = value.slice(selectionStart);
          const firstHalfTerm = /\[\[([^[\]]+)$/.exec(precursor)?.[1];
          const secondHalfTerm = /^([^[\]]*)\]\]/.exec(postcursor)?.[1];

          const valueWithLink = `${precursor.slice(
            0,
            -firstHalfTerm.length - 2
          )}[[${post.topic.fancy_title}]]`;
          target.value = `${valueWithLink}${postcursor.slice(
            secondHalfTerm.length + 2
          )}`;
          target.focus();
          target.setSelectionRange(valueWithLink.length, valueWithLink.length);
          popover.remove();
          posts = [];
          e.preventDefault();
          e.stopPropagation();
        }
      }
    } else if (goLeft || goRight) {
      const { target } = e;
      if (
        target.nodeName === "TEXTAREA" &&
        target.classList.contains("ember-text-area")
      ) {
        const popover = document.getElementById(POPOVER_ID);
        if (popover) {
          const { selectionStart, value } = target;
          if (
            (value.charAt(selectionStart) === "[" &&
              value.charAt(selectionStart - 1) === "[") ||
            (value.charAt(selectionStart) === "]" &&
              value.charAt(selectionStart - 1) === "]")
          ) {
            popover.remove();
            posts = [];
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    }
  });

  const isClass = (d, clss) => d.classList && d.classList.contains(clss);
  const createClassObserver = ({ wrapper, attribute, callback }) =>
    new MutationObserver(function (records) {
      new Set(
        records.flatMap((r) =>
          Array.from(r.addedNodes)
            .filter((d) => isClass(d, wrapper) || d.hasChildNodes())
            .flatMap((d) =>
              isClass(d, wrapper)
                ? [d]
                : Array.from(d.querySelectorAll(`.${wrapper}`))
            )
        )
      ).forEach((el) => {
        const dataAttribute = `data-${attribute}-observer`;
        if (!el.hasAttribute(dataAttribute)) {
          el.setAttribute(dataAttribute, "true");
          callback(el);
        }
      });
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });

  const titleToSlug = (title) =>
    title
      .replace(/[^a-z0-9A-Z\s/]\s?/g, "")
      .replace(/[\s/]/g, "-")
      .toLowerCase();

  const startWikilinksObserver = ({ wrapper, content }) => {
    return createClassObserver({
      wrapper,
      attribute: "wikilinks",
      callback: (el) => {
        const callback = () => {
          document.querySelectorAll(`.${content} p`).forEach((p) => {
            const nodesToEdit = Array.from(p.childNodes).filter(
              (n) => n.nodeName === "#text" && REGEX.test(n.nodeValue)
            );
            nodesToEdit.forEach((n) => {
              const parts = n.nodeValue.split(REGEX);
              parts.forEach((part, index) => {
                if (index % 2 === 1) {
                  const anchor = document.createElement("a");
                  anchor.href = `/t/${titleToSlug(part)}`;
                  anchor.innerText = part;
                  anchor.onclick = () => window.location.assign(anchor.href);
                  p.insertBefore(anchor, n);
                } else {
                  p.insertBefore(document.createTextNode(part), n);
                }
              });
              if (parts.length) {
                n.remove();
              }
            });
          });
        };
        new MutationObserver(callback).observe(el, {
          childList: true,
          subtree: true,
          attributes: false,
          characterData: true,
        });
        callback();
      },
    });
  };
  startWikilinksObserver({
    wrapper: "d-editor-preview-wrapper",
    content: "d-editor-preview",
  });

  // api.addPostTransformCallback((...args) => {
  //    could replace observer below
  // });
  startWikilinksObserver({
    wrapper: "topic-body",
    content: "cooked",
  });

  // Hacky! TODO Improve
  let wikilinks = [];
  let searchedWikilinks = false;
  api.reopenWidget("post-links", {
    html(attrs, state) {
      if (searchedWikilinks) {
        this.attrs.links = (this.attrs.links || []).concat(wikilinks);
        searchedWikilinks = false;
      } else {
        const self = this;
        fetch(`${self.attrs.actionCodePath}.json`)
          .then((r) => r.json())
          .then((r) => r.title)
          .then((title) =>
            searchForTerm(`[[${title}]]`).then((r) => {
              searchedWikilinks = true;
              wikilinks = r.topics
                .map((t) => ({
                  title: t.title,
                  url: `${window.location.origin}/t/${t.slug}/${t.id}`,
                  internal: true,
                  reflection: true,
                }))
                .filter((t) => t.title !== title);
              self.scheduleRerender();
            })
          )
          .catch(() => {
            searchedWikilinks = false;
          });
      }
      return originalPostLinksHtml.bind(this)(attrs, state);
    },
  });

  const createByWikilink = (title) => {
    const data = {
      raw: "This post was automatically created via a wikilink",
      title,
      // I copied the rest of these args from `/models/composer.js:createPost`
      // From a breakpoint on `/adapters/post.js:createRecord`
      unlist_topic: false,
      category: null,
      is_warning: false,
      archetype: "regular",
      typing_duration_msecs: 5000,
      composer_open_duration_msecs: 28014,
      shared_draft: false,
      draft_key: "new_topic",
      image_sizes: {},
      nested_post: true,
    };
    return false
      ? fetch("/posts", {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            "X-CSRF-Token": document.head.querySelector("meta[name=csrf-token]")
              ?.content,
            "Content-Type": "application/json; charset=UTF-8",
          },
        })
      : ajax("/posts", { type: "POST", data });
  };

  createClassObserver({
    wrapper: "save-or-cancel",
    attribute: "create-post",
    callback: (el) => {
      const button = el.querySelector("button");
      if (button) {
        button.addEventListener("click", () => {
          const editor = document.querySelector("textarea.d-editor-input");
          const value = editor.value;
          const links = Array.from(value.matchAll(new RegExp(REGEX, "g"))).map(
            (a) => a[1] || ""
          );
          // there's no way to fetch topics by title yet - let's make this change upstream in discourse
          Promise.all(
            links
              .map((title) => ({
                title,
                slug: titleToSlug(title),
              }))
              .map((link) =>
                fetch(`/t/${link.slug}`).then((r) => {
                  if (r.ok) {
                    // no need to create any new post
                    return Promise.resolve();
                  } else {
                    return createByWikilink(link.title);
                  }
                })
              )
          );
        });
      }
    },
  });
};

export default {
  name: "wikilinks-init",
  initialize() {
    withPluginApi("0.8.7", initializeWikilinks);
  },
};
