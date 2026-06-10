async function getCurrentPageHeadline() {

    let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    let results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },

        func: () => {

            const selectors = [
                "h1",
                ".headline",
                ".article-title"
            ];

            for (const selector of selectors) {

                const element =
                    document.querySelector(selector);

                if (
                    element &&
                    element.innerText
                ) {
                    return element.innerText;
                }
            }

            return document.title;
        }
    });

    return results[0].result;
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const headline =
            await getCurrentPageHeadline();

        document
            .getElementById("headline")
            .value = headline;
    }
);

document
.getElementById("analyze")
.addEventListener("click", async () => {

    const headline =
        document.getElementById("headline").value;

    const response = await fetch(
        "http://127.0.0.1:8000/predict_style",
        {
            method: "POST",

            headers: {
                "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
                headline: headline
            })
        }
    );

    const data = await response.json();

let color = "#4CAF50"; // Green

if (data.score > 70)
    color = "#ff4d4d"; // Red

else if (data.score > 40)
    color = "#ffb84d"; // Orange

document.getElementById(
    "result"
).innerHTML = `

<h3>${data.category}</h3>

<div class="progress-container">
    <div
        class="progress-bar"
        style="
            width:${data.score}%;
            background:${color};
        ">
    </div>
</div>

<p><b>Score:</b> ${data.score}%</p>

<p><b>Reasons:</b>
${data.reasons.join(", ")}
</p>
`;
});
document
.getElementById("analyzeArticle")
.addEventListener("click", async () => {

    let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    let results =
        await chrome.scripting.executeScript({
            target: {
                tabId: tab.id
            },

            func: () => {
                // Extract Important Information
                const headline =
                    document.querySelector("h1")
                    ?.innerText || "";

                const title =
                    document.title || "";

                const description =
                    document.querySelector(
                        "meta[name='description']"
                    )?.content || "";

                const article_text =
                    document.body.innerText
                    .slice(0, 5000);

                return {
                    headline,
                    title,
                    description,
                    article_text
                };
            }
        });

    const articleData =
        results[0].result;

    const response =
        await fetch(
            "http://127.0.0.1:8000/predict_consistency",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                    "application/json"
                },

                body: JSON.stringify(
                    articleData
                )
            }
        );

    const data =
        await response.json();

    document.getElementById(
        "result"
    ).innerHTML += `

    <hr>

    <h3>
        After-Click Analysis
    </h3>

    <p>
    <b>Clickbait Risk After Reading:</b>
    ${data.consistency_score}%
</p>

    <p>
        <b>Category:</b>
        ${data.category}
    </p>

    <p>
    <b>Reasons:</b>
    ${
        data.reasons.length > 0
        ? data.reasons.join(", ")
        : "No clickbait indicators detected"
    }
</p>
    `;
});