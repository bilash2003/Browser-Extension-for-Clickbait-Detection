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

// Renders the model's per-class probability breakdown
// (e.g. Low / Moderate / High Clickbait) as a small bar list.
// `compact` drops the "Confidence" heading, useful when nesting it
// inside an already-labeled section like the after-click analysis.
function renderConfidenceBreakdown(confidence, compact = false) {

    if (!confidence) {
        return "";
    }

    const rows = Object.entries(confidence)
        .map(([label, pct]) => `
            <div style="
                display:flex;
                justify-content:space-between;
                margin-bottom:4px;
            ">
                <span>${label}</span>
                <span><b>${pct}%</b></span>
            </div>
        `)
        .join("");

    const heading = compact
        ? ""
        : `<p style="margin-bottom:4px;"><b>Confidence:</b></p>`;

    return `${heading}${rows}`;
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
        `${CONFIG.API_BASE_URL}/predict_style`,
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

    let color = "#3ddc84";

    if (data.score > 70)
        color = "#ff5c72";

    else if (data.score > 40)
        color = "#ffb84d";

    document.getElementById(
        "result"
    ).innerHTML = `

<h3 style="
    color:${color};
">
    ${data.category}
</h3>

<div class="progress-container">
    <div
        class="progress-bar"
        style="
            width:${data.score}%;
            background:${color};
        ">
    </div>
</div>

<p>
    <b>Score:</b>
    ${data.score}%
</p>

<p>
    <b>Processed In:</b>
    ${data.processing_time_ms} ms
</p>

<p>
    <b>Reasons:</b>
    ${
        data.reasons.length
            ? data.reasons.join(", ")
            : "No clickbait indicators detected"
    }
</p>

${renderConfidenceBreakdown(data.confidence)}
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
                    .slice(0, 3000);

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
            `${CONFIG.API_BASE_URL}/predict_consistency`,
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

    let afterColor = "#3ddc84";

    if (data.consistency_score > 70)
        afterColor = "#ff5c72";

    else if (
        data.consistency_score > 40
    )
        afterColor = "#ffb84d";

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

<p style="
    color:${afterColor};
    font-weight:bold;
">
    ${data.category}
</p>

<div style="
    background:#242639;
    border:1px solid #2f3247;
    border-radius:8px;
    padding:8px;
    margin:8px 0;
    font-size:12px;
">
    ${renderConfidenceBreakdown(data.confidence, true)}
</div>

<p>
    <b>Reasons:</b>
    ${
        data.reasons.length
            ? data.reasons.join(", ")
            : "No clickbait indicators detected"
    }
</p>

<details>
    <summary>
        See Analysis Input
    </summary>

    <p>
        <b>Headline:</b><br>
        ${articleData.headline}
    </p>

    <p>
        <b>Title:</b><br>
        ${articleData.title}
    </p>

    <p>
        <b>Description:</b><br>
        ${articleData.description}
    </p>

    <p>
        <b>Article Length:</b>
        ${articleData.article_text.length}
        characters
    </p>

    <p>
        <b>Article Preview:</b><br>
        ${articleData.article_text.substring(
            0,
            1000
        )}
    </p>

</details>
`;
});
