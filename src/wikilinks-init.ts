import { withPluginApi } from "../../../../../app/assets/javascripts/discourse/app/lib/plugin-api";
import { searchForTerm } from "../../../../../app/assets/javascripts/discourse/app/lib/search";

const initializeWikilinks = () => {
  document.addEventListener("input", ((e: InputEvent) => {
    const target = e.target as Element;
    if (
      target.nodeName === "TEXTAREA" &&
      target.classList.contains("ember-text-area")
    ) {
      const textarea = target as HTMLTextAreaElement;
      const { selectionStart, selectionEnd, value } = textarea;
      if (e.data === "[") {
        if (value.endsWith("[[")) {
          textarea.value = `${textarea.value}]]`;
          textarea.setSelectionRange(selectionStart, selectionEnd);
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
                  textarea.value = `${valueWithLink}${postcursor.slice(
                    secondHalfTerm.length + 2
                  )}`;
                  textarea.focus();
                  textarea.setSelectionRange(
                    valueWithLink.length,
                    valueWithLink.length
                  );
                };

                const anchor = document.createElement("a");
                anchor.className = "selected";
                item.appendChild(anchor);

                const img = document.createElement("img");
                img.loading = "lazy";
                img.width = 20;
                img.height = 20;
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
        }
      }
    }
  }) as EventListener);
};

export default {
  name: "wikilinks-init",
  initialize() {
    withPluginApi("0.8.7", initializeWikilinks);
  },
};
