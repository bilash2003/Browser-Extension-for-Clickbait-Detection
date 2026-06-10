let tooltip = document.createElement("div");

tooltip.style.position = "fixed";
tooltip.style.zIndex = "999999";
tooltip.style.padding = "8px";
tooltip.style.background = "white";
tooltip.style.border = "1px solid black";
tooltip.style.borderRadius = "8px";
tooltip.style.boxShadow =
    "0 2px 10px rgba(0,0,0,0.2)";
tooltip.style.display = "none";
tooltip.style.maxWidth = "250px";

document.body.appendChild(tooltip);

let lastHeadline = "";

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
            headlineElement.innerText;

        if (!text)
            return;

        if (text.length < 20)
            return;

        if (text.length > 200)
            return;

        if (text === lastHeadline)
            return;

        lastHeadline = text;

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

                console.log(
                    "Response:",
                    response
                );

                let color = "#4CAF50";

                if (response.score > 70)
                    color = "#ff4d4d";

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
    height:10px;
    background:#ddd;
    border-radius:5px;
    overflow:hidden;
    margin-bottom:5px;
">
    <div style="
        width:${response.score}%;
        height:100%;
        background:${color};
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
    margin-top:6px;
    font-size:11px;
    color:#666;
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