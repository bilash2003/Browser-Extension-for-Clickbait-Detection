importScripts("config.js");

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {

        if (request.type === "analyze") {

            try {

                const response =
                    await fetch(
                        `${CONFIG.API_BASE_URL}/predict_style`,
                        {
                            method: "POST",   

                            headers: {
                                "Content-Type":
                                "application/json"
                            },

                            body: JSON.stringify({
                                headline:
                                request.headline
                            })
                        }
                    );

                const data =
                    await response.json();

                sendResponse(data);

            } catch (error) {

                sendResponse({
                    error:
                    error.message
                });
            }

            return true; 
        }
    }
);
