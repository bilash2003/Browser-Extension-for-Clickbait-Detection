let tooltip = document.createElement("div");

tooltip.style.position = "fixed";
tooltip.style.zIndex = "999999";
tooltip.style.padding = "12px";
tooltip.style.background = "#1c1e2b";
tooltip.style.color = "#eaeaf2";
tooltip.style.border = "1px solid #2f3247";
tooltip.style.borderRadius = "10px";
tooltip.style.boxShadow =
    "0 8px 24px rgba(0,0,0,0.35)";    
tooltip.style.display = "none";
tooltip.style.maxWidth = "260px";
tooltip.style.fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
tooltip.style.fontSize = "13px";
tooltip.style.lineHeight = "1.5";
tooltip.style.transition = "opacity 0.15s ease";

document.body.appendChild(tooltip);

let lastHeadline = "";

// Cache of headline text -> API response, so hovering the same
// headline again doesn't re-hit the backend. Cleared on page reload.
const analysisCache = new Map();

// Simple debounce helper: delays calling `fn` until `delay` ms have
// passed without it being called again. Prevents API spam when the
// mouse sweeps quickly across many headlines.
function debounce(fn, delay) {

    let timeoutId = null;

    return (...args) => {

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
        }, delay);
    };
}

function renderTooltip(response, headlineElement) {

    if (!response || response.error) {
        return;
    }

    console.log(
        "Response:",
        response
    );

    let color = "#3ddc84";

    if (response.score > 70)
        color = "#ff5c72";

    else if (
        response.score > 40
    )
        color = "#ffb84d";

    tooltip.style.border =
        `2px solid ${color}`;

    tooltip.innerHTML = `

<div style="
    color:${color};
    font-weight:bold;
    margin-bottom:5px;
">
    ${response.category}
</div>

<div style="
    width:150px;
    height:8px;
    background:#2f3247;
    border-radius:20px;
    overflow:hidden;
    margin-bottom:6px;
">
    <div style="
        width:${response.score}%;
        height:100%;
        background:${color};
        border-radius:20px;
    ">
    </div>
</div>

<div>
    Score:
    ${response.score}%
</div>

<div style="
    margin-top:6px;
    font-size:12px;
    color:#c7c9dd;
">

    ${
        response.reasons &&
        response.reasons.length

        ?

        response.reasons.join("<br>")

        :

        "No indicators detected"
    }

</div>

<div style="
    margin-top:8px;
    padding-top:6px;
    border-top:1px solid #2f3247;
    font-size:11px;
    color:#9294ac;
">
    Powered by MiniLM
</div>
`;

    tooltip.style.display =
        "block";

    if (
        window.lastHighlighted
    ) {
        window.lastHighlighted
            .style.outline = "";
    }

    headlineElement.style.transition =
        "all 0.3s ease";

    if (
        response.score > 70
    ) {

        headlineElement.style.outline =
            "2px solid red";

    }
    else if (
        response.score > 40
    ) {

        headlineElement.style.outline =
            "2px solid orange";

    }
    else {

        headlineElement.style.outline =
            "2px solid green";

    }

    window.lastHighlighted =
        headlineElement;
}

function analyzeHeadline(text, headlineElement) {

    // Serve from cache if we've already analyzed this exact text.
    if (analysisCache.has(text)) {
        renderTooltip(
            analysisCache.get(text),
            headlineElement
        );
        return;
    }

    chrome.runtime.sendMessage(
        {
            type: "analyze",
            headline: text
        },

        (response) => {

            if (
                !response ||
                response.error
            ) {
                return;
            }

            analysisCache.set(text, response);

            renderTooltip(response, headlineElement);
        }
    );
}

const debouncedAnalyzeHeadline = debounce(
    analyzeHeadline,
    250
);

document.addEventListener(
    "mouseover",
    (event) => {

        const element = event.target;

        const headlineElement =
            element.closest(
                "h1,h2,h3,h4,h5,h6,a"
            );

        if (!headlineElement)
            return;

        const text =
            headlineElement.innerText
                .replace(/\s+/g, " ")
                .trim();

        if (!text)
            return;

        if (text.length < 20)
            return;

        if (text.length > 200)
            return;

        if (text === lastHeadline)
            return;

        lastHeadline = text;

        debouncedAnalyzeHeadline(
            text,
            headlineElement
        );
    }
);

document.addEventListener(
    "mousemove",
    (event) => {

        tooltip.style.left =
            (event.clientX + 15) + "px";

        tooltip.style.top =
            (event.clientY + 15) + "px";
    }
);

document.addEventListener(
    "mouseout",
    () => {

        tooltip.style.display =
            "none";
    }
);
