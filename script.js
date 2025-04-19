const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector("#prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");


const api_key = "AIzaSyDpnmTe1uXVbVno4tyxaOGDxWF11WL9jdc";
const api_url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${api_key}`;


let typingInterval, controller;
let userData = { message: "", file: {} };
const chatHistory = [];


const createMsgElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

const scrollToBottom = () => {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
};

const typingEffect = (text, textElement, botMsgDIV) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordsIndex = 0;
    typingInterval = setInterval(() => {
        if (wordsIndex < words.length) {
            textElement.textContent += (wordsIndex === 0 ? "" : " ") + words[wordsIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
            document.body.classList.remove("bot-responding");
            botMsgDIV.classList.remove("loading");
        }
    }, 200);
};


const generateResponse = async (botMsgDIV) => {
    controller = new AbortController();
    try {
        const payload = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.9,
                topP: 1,
                topK: 1,
                maxOutputTokens: 2048
            }
        };

        const response = await fetch(api_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("API Error:", errorData);
            throw new Error(errorData.error?.message || "API request failed");
        }

        const data = await response.json();

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error("Invalid response format from API");
        }

        const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
        const textElement = botMsgDIV.querySelector(".message-text");
        typingEffect(responseText, textElement, botMsgDIV);

        chatHistory.push({
            role: "model",
            parts: [{ text: responseText }]
        });
    } catch (error) {
        console.error("Error:", error);
        const errorMessage = error.message.includes("content")
            ? "The file format may not be supported"
            : error.message;
        botMsgDIV.querySelector(".message-text").textContent = `Response Generation Stopped`;
        botMsgDIV.querySelector(".message-text").style.color = "#d62939";
    } finally {
        userData.file = {};
        fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
        fileInput.value = "";
    }
};

const handleFormSubmit = (e) => {
    e.preventDefault();

    if (document.body.classList.contains("bot-responding")) return;

    const userMessage = promptInput.value.trim();
    if (!userMessage && !userData.file.data) return;

    document.body.classList.add("bot-responding", "chats-active");
    promptInput.value = "";
    userData.message = userMessage;
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

    const parts = [];
    if (userMessage) parts.push({ text: userMessage });
    if (userData.file.data) {
        parts.push({
            inline_data: {
                mime_type: userData.file.mime_type,
                data: userData.file.data
            }
        });
    }


    chatHistory.push({
        role: "user",
        parts: parts
    });


    const userMsgHTML = `
        <p class="message-text">${userMessage || ""}</p>
        ${userData.file.data
            ? (userData.file.isImage
                ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
                : `<p class="file-attachment">
                    <span class="materials-symbols-outlined">description</span>
                    ${userData.file.fileName}
                  </p>`)
            : ""}
    `;

    const userMsgDIV = createMsgElement(userMsgHTML, "user-message");
    chatsContainer.appendChild(userMsgDIV);
    scrollToBottom();


    setTimeout(() => {
        const botMsgHTML = `
            <img src="gemini.svg" class="avatar">
            <p class="message-text">Loading...</p>
        `;
        const botMsgDIV = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDIV);
        scrollToBottom();
        generateResponse(botMsgDIV);
    }, 300);
};


fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();

    reader.onload = (e) => {
        const base64String = e.target.result.split(",")[1];
        userData.file = {
            fileName: file.name,
            mime_type: file.type,
            data: base64String,
            isImage: isImage
        };

        const previewElement = fileUploadWrapper.querySelector("file-preview") ||
        document.createElement("img");
        previewElement.classList.add("file-preview");
        previewElement.src = e.target.result;
        fileUploadWrapper.prepend(previewElement);

        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
    };

    reader.onerror = () => {
        console.error("File reading failed");
    };

    reader.readAsDataURL(file);
});

document.querySelector("#remove-file-btn").addEventListener("click", () => {
    userData.file = {};
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
    fileInput.value = "";
    const preview = fileUploadWrapper.querySelector(".file-preview");
    if (preview) preview.remove();
});

document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all chats?")) {
        chatHistory.length = 0;
        chatsContainer.innerHTML = "";
        document.body.classList.remove("bot-responding", "chats-active");
    }
});

document.querySelector("#stop-response-btn").addEventListener("click", () => {
    controller?.abort();
    clearInterval(typingInterval);
    const loadingMessage = chatsContainer.querySelector(".bot-message.loading");
    if (loadingMessage) {
        loadingMessage.classList.remove("loading");
        loadingMessage.querySelector(".message-text").textContent += `\n Response Stopped...`;
    }
    document.body.classList.remove("bot-responding");
});

document.addEventListener("click", ({ target }) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop=response-btn"));
    wrapper.classList.toggle("hide-controls", shouldHide);
})

document.querySelectorAll(".suggestions-items").forEach(item => {
    item.addEventListener("click", () => {
        promptInput.value = item.querySelector(".text").textContent;
        handleFormSubmit(new Event("submit"));
    })
});

themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
})

const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => {
    fileInput.click();
});