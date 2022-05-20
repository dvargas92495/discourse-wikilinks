import { withPluginApi } from "discourse/lib/plugin-api";
import { on } from "discourse-common/utils/decorators";
import {
  findRawTemplate,
  addRawTemplate,
} from "discourse-common/lib/raw-templates";
import { caretPosition, inCodeBlock } from "discourse/lib/utilities";
import userSearch from "discourse/lib/user-search";
import getURL from "discourse-common/lib/get-url";
import {
  isValidSearchTerm,
  searchForTerm,
  updateRecentSearches,
} from "discourse/lib/search";

const pluginId = "wikilinks";

const autocomplete = (el) => {
  const $input = $(el);
  debugger;
  $input.autocomplete({
    template: findRawTemplate("post-selector-autocomplete"),
    dataSource: (term) => {
      console.log("seach", term);

      return userSearch({
        term,
        topicId: undefined,
        categoryId: null,
        includeGroups: true,
      });
    },
    key: "[[",
    transformComplete: (v) => v.username || v.name,
    afterComplete: (el) => console.log("aftercomplete", el),
    triggerRule: (textarea) => {
      console.log("trigger me timbers?");
      return !inCodeBlock(textarea.value, caretPosition(textarea));
    },
  });
};

const initializeWikilinks = (api) => {
  //   api.modifyClass("controller:composer", {
  //     pluginId,
  //     actions: {
  //       @on("didInsertElement")
  //       wikilinkEditor() {
  //         autocomplete(this.element.querySelector(".d-editor-input"));
  //       },
  //     },
  //   });
  //   document.addEventListener("keydown", (e) => {
  //     if (e.shiftKey && e.altKey) {
  //       console.log("gogo", e.target.classList);
  //       autocomplete(e.target);
  //     }
  //   });
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
          const popover = document.getElementById("wikilinks-popover");
          const firstHalfTerm = /\[\[([^[\]]+)$/.exec(precursor)?.[1];
          const secondHalfTerm = /^([^[\]]*)\]\]/.exec(postcursor)?.[1];
          const term = `${firstHalfTerm}${secondHalfTerm}`;
          const loadItems = (container) =>
            searchForTerm(term).then((results) => {
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
            popoverRef.id = "wikilinks-popover";
            popoverRef.className = "autocomplete ac-user";
            popoverRef.style.left = "25px";
            popoverRef.style.position = "absolute";
            popoverRef.style.top = "-92.234px";

            const list = document.createElement("ul");
            popoverRef.appendChild(list);

            loadItems(list);

            target.parentElement.appendChild(popoverRef);
            document.addEventListener("click", () => popoverRef.remove(), {
              once: true,
            });
          }

          //   <svg class="fa d-icon d-icon-users svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#users"></use></svg>
        }
      }
    }
  });
};

export default {
  name: "wikilinks-init",
  initialize() {
    withPluginApi("0.8.7", initializeWikilinks);
  },
};
