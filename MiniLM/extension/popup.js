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
            // document.title often has a site-name suffix appended,
            // e.g. "Headline Text — CNN" or "Headline Text | BBC News".
            // Strip anything after a trailing separator so we send just
            // the headline itself, not the site branding.
            let title = document.title || "";
            title = title.split(/\s+[-–—|]\s+/)[0];

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
                font-size:11.5px;
            ">
                <span style="color:var(--text-muted);">${label}</span>
                <span style="font-weight:600;">${pct}%</span>
            </div>
        `)
        .join("");

    const heading = compact
        ? ""
        : `<p style="margin-bottom:4px; font-size:11.5px;"><b>Confidence:</b></p>`;

    return `${heading}${rows}`;
}
//
// Renders the main score as a large, color-highlighted number, so it
// stands out clearly above the smaller confidence breakdown.
function renderScoreBlock(label, value, color) {
    return `
        <div style="margin:10px 0;">
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:2px;">
                ${label}
            </div>
            <div style="font-size:30px; font-weight:800; color:${color}; line-height:1.1;">
                ${value}%
            </div>
        </div>
    `;
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

    // trim..........
    const headline =
        document.getElementById("headline").value
            .replace(/\s+/g, " ")
            .trim();

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

${renderScoreBlock("Score", data.score, color)}

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
                function clean(text) {
                    return text.replace(/\s+/g, " ").trim();
                }

                const headline =
                    document.querySelector("h1")
                    ?.innerText ? clean(document.querySelector("h1").innerText) : "";

                const title =
                    document.title ? clean(document.title) : "";

                const description =
                    document.querySelector(
                        "meta[name='description']"
                    )?.content || "";

               function getArticleBody(wordLimit = 300) {
               let fullText = "";
               
                // ..............................
            //     const headline =
            //         document.querySelector("h1")
            //         ?.innerText || "";

            //     const title =
            //         document.title || "";

            //     const description =
            //         document.querySelector(
            //             "meta[name='description']"
            //         )?.content || "";

            //    function getArticleBody(wordLimit = 300) {
            //    let fullText = "";

               
               const container = document.querySelector('article, .article-body, .story-content, .post-content, .entry-content');

               if (container) {
              
               const paragraphs = Array.from(container.querySelectorAll('p'));
               fullText = paragraphs
               .map(p => p.innerText.trim())
               .filter(text => text.length > 0)
               .join('\n\n');
               }
               else {
              
               const allParagraphs = Array.from(document.querySelectorAll('p'));
               fullText = allParagraphs
               .map(p => p.innerText.trim())
               .filter(text => text.length > 50)
               .join('\n\n');
            }

            
               if (!fullText) return "";
              
               const words = fullText.split(/\s+/);
             
               if (words.length <= wordLimit) {
               return fullText;
               }
            
              const truncatedText = words.slice(0, wordLimit).join(' ');
            
              const lastFullStopIndex = truncatedText.lastIndexOf('.');
            
              if (lastFullStopIndex !== -1) {
                return truncatedText.substring(0, lastFullStopIndex + 1);
              }

              return truncatedText + "...";
    }

               const article_text = getArticleBody(200);

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

<p style="
    color:${afterColor};
    font-weight:bold;
">
    ${data.category}
</p>

${renderScoreBlock("Clickbait Scale", data.consistency_score, afterColor)}

<div style="
    background:#242639;
    border:1px solid #2f3247;
    border-radius:8px;
    padding:8px;
    margin:8px 0;
    font-size:12px;
"> 
    <div style="display:flex; justify-content:space-between;">
        <span>Headline &harr; content match</span>
        <span><b>${data.semantic_similarity}%</b></span>
    </div>
</div>

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
