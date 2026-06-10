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

    let color = "#4CAF50";

    if (data.score > 70)
        color = "#ff4d4d";

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

    let afterColor = "#4CAF50";

    if (data.consistency_score > 70)
        afterColor = "#ff4d4d";

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