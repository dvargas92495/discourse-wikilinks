export default {
    name: "textarea-observer",
    initialize() {
        document.addEventListener("input", (e) => {
            if (e.data === '[') {
                const {target} = e;
                if (target.nodeName === 'TEXTAREA' && target.classList.contains("ember-text-area")) {
                    const value = target.value;
                    if (value.endsWith("[[")) {
                        const {selectionStart, selectionEnd} = target;
                        target.value = `${target.value}]]`;
                        target.setSelectionRange(selectionStart, selectionEnd);
                    }
                }
            }
        })
    }
}