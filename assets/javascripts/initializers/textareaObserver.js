export default {
    name: "textarea-observer",
    initialize() {
        document.addEventListener("input", (e) => {
            const {target} = e;
            if (target.nodeName === 'TEXTAREA' && target.classList.contains("ember-text-area")) {
                const {selectionStart, selectionEnd, value} = target;
                if (e.data === '[') {
                    if (value.endsWith("[[")) {
                        target.value = `${target.value}]]`;
                        target.setSelectionRange(selectionStart, selectionEnd);
                    }
                } else {
                    const precursor = value.slice(0, selectionStart);
                    const postcursor = value.slice(selectionStart);
                    if (/^[^[]+\]\]/.test(postcursor) && /\[\[[^\]]+$/.test(precursor)) {
                        // render @ popover
                    }
                }
            }
        })
    }
}