chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {

        if (request.type === "analyze") {

            try {

                const response =
                    await fetch(
                        "http://127.0.0.1:8000/predict_style",
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