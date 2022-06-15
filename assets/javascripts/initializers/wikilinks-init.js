import { withPluginApi } from "discourse/lib/plugin-api";
import { searchForTerm } from "discourse/lib/search";
import { h } from "virtual-dom";

const POPOVER_ID = "wikilinks-popover";

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

  const startWikilinksObserver = ({ wrapper, content }) => {
    const isPreview = (d) => d.classList && d.classList.contains(wrapper);
    const REGEX = /\[\[([^\]]+)\]\]/;
    new MutationObserver(function (records) {
      new Set(
        records.flatMap((r) =>
          Array.from(r.addedNodes)
            .filter((d) => isPreview(d) || d.hasChildNodes())
            .flatMap((d) =>
              isPreview(d) ? [d] : Array.from(d.querySelectorAll(`.${wrapper}`))
            )
        )
      ).forEach((el) => {
        if (!el.hasAttribute("data-wikilinks-observer")) {
          el.setAttribute("data-wikilinks-observer", "true");
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
                    anchor.href = `/t/${part
                      .replace(/[^a-z0-9A-Z\s/]/g, "")
                      .replace(/[\s/]/g, "-")
                      .toLowerCase()}`;
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
        }
      });
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });
  };
  startWikilinksObserver({
    wrapper: "d-editor-preview-wrapper",
    content: "d-editor-preview",
  });
  startWikilinksObserver({
    wrapper: "topic-body",
    content: "cooked",
  });

  // api.addPostTransformCallback((...args) => {
  //   console.log("posty", ...args);
  // });

  // Hacky! TODO Improve
  let wikilinks = [
    {
      url: "https://youtube.com",
      title: "YouTube",
      internal: true,
      reflection: true,
    },
  ];
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
          .catch((e) => {
            console.error(e);
          });
      }
      return originalPostLinksHtml.bind(this)(attrs, state);
    },
  });
};

export default {
  name: "wikilinks-init",
  initialize() {
    withPluginApi("0.8.7", initializeWikilinks);
  },
};
