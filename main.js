const STORAGE_KEY = 'surreal_dream_world_scenes';

// DOM Elements
const currentImageEl = document.getElementById('current-image');
const loadingOverlayEl = document.getElementById('loading-overlay');
const generateButton = document.getElementById('generate-button');
const clearHistoryButton = document.getElementById('clear-history-button');
const historyGalleryEl = document.getElementById('history-gallery');
const noScenesMessage = document.getElementById('no-scenes-message');
const historyEmptyMessage = document.getElementById('history-empty-message');

// Core Prompt
const BASE_PROMPT = `A surreal, dreamlike anime-inspired world where human figures constantly morph and dissolve into abstract fractal textures and glowing pastel dreamscapes. Faces with delicate features distort and shift like hallucinations, blending with ghostly overlays, glitch artifacts, neon accents, and painterly brushstrokes. The environment flows around the characters as if alive, with fluid transitions, soft light halos, and chromatic aberrations creating a hypnotic, unsettling yet beautiful atmosphere. The entire scene feels like drifting inside a digital illusion, where boundaries between body, memory, and landscape blur into one continuous, uncanny hallucination. Cinematic lighting, highly detailed, octane render, 8K.`;

let scenes = [];
let isGenerating = false;

// --- Local Storage Management ---

function loadScenes() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        scenes = data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Failed to load scenes from localStorage:", e);
        scenes = [];
    }
}

function saveScenes() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes));
    } catch (e) {
        console.error("Failed to save scenes to localStorage:", e);
    }
}

// --- UI Rendering ---

function updateSceneDisplay(scene) {
    if (scene) {
        currentImageEl.src = scene.imageUrl;
        currentImageEl.style.display = 'block';
        noScenesMessage.classList.add('hidden');
    } else {
        currentImageEl.src = '';
        currentImageEl.style.display = 'none';
        noScenesMessage.classList.remove('hidden');
    }
}

function renderHistoryGallery() {
    historyGalleryEl.innerHTML = '';

    if (scenes.length === 0) {
        historyEmptyMessage.classList.remove('hidden');
        return;
    }

    historyEmptyMessage.classList.add('hidden');

    // Display the scenes chronologically
    scenes.forEach((scene) => {
        const img = document.createElement('img');
        img.src = scene.imageUrl;
        img.alt = `Scene ${scene.id}`;
        img.classList.add('history-thumbnail');
        img.dataset.sceneId = scene.id;

        img.addEventListener('click', () => {
            displaySceneById(scene.id);
        });

        historyGalleryEl.appendChild(img);
    });

    // Ensure the latest scene is displayed and highlighted
    const lastScene = scenes[scenes.length - 1];
    if (lastScene) {
        displaySceneById(lastScene.id);
    }
}

function displaySceneById(id) {
    const scene = scenes.find(s => s.id === id);
    if (scene) {
        updateSceneDisplay(scene);
        
        // Remove active class from all thumbnails
        document.querySelectorAll('.history-thumbnail').forEach(thumb => {
            thumb.classList.remove('active');
        });

        // Add active class to the selected thumbnail
        const activeThumbnail = document.querySelector(`.history-thumbnail[data-scene-id="${id}"]`);
        if (activeThumbnail) {
            activeThumbnail.classList.add('active');
            // Ensure the active thumbnail is visible in the scrollable gallery
            activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

// --- Generation Logic ---

function setGenerating(status) {
    isGenerating = status;
    generateButton.disabled = status;
    clearHistoryButton.disabled = status;

    if (status) {
        loadingOverlayEl.classList.remove('hidden');
        generateButton.textContent = 'Generating... (Wait ~10s)';
    } else {
        loadingOverlayEl.classList.add('hidden');
        generateButton.textContent = 'Generate Next Scene';
    }
}

async function urlToDataUrl(url) {
    if (!url) return null;
    try {
        // Fetch the asset/image URL
        const response = await fetch(url);
        // Ensure response is OK
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        
        // Convert Blob to Data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to convert URL to Data URL:", e);
        // Return null if fetching or conversion fails
        return null; 
    }
}

async function generateNextScene() {
    if (isGenerating) return;

    setGenerating(true);

    try {
        const nextId = scenes.length > 0 ? scenes[scenes.length - 1].id + 1 : 1;
        
        const prompt = BASE_PROMPT; 
        
        let imageInputs = [];
        const lastScene = scenes[scenes.length - 1];

        if (lastScene) {
            console.log(`Using previous scene (ID: ${lastScene.id}) as image input for continuation.`);
            // Convert the previous scene's image URL to a data URL
            const dataUrl = await urlToDataUrl(lastScene.imageUrl);
            if (dataUrl) {
                imageInputs.push({ url: dataUrl });
            } else {
                console.warn("Could not get data URL for previous scene. Generating from text prompt only.");
            }
        }
        
        console.log(`Generating scene ${nextId} with prompt: ${prompt}`);

        const generationParams = {
            prompt: prompt,
            aspect_ratio: "16:9",
        };
        
        if (imageInputs.length > 0) {
            generationParams.image_inputs = imageInputs;
            // Optionally, we might want to adjust the prompt slightly when using image input 
            // to emphasize transformation, but for continuity, the base prompt works well too.
        }

        const result = await websim.imageGen(generationParams);

        const newScene = {
            id: nextId,
            prompt: prompt,
            imageUrl: result.url,
            timestamp: Date.now()
        };

        scenes.push(newScene);
        saveScenes();
        renderHistoryGallery();
        
    } catch (error) {
        console.error("AI Image Generation failed:", error);
        alert("Failed to generate scene. Please check the console for details.");
    } finally {
        setGenerating(false);
    }
}

function clearHistory() {
    if (confirm("Are you sure you want to erase all memories of this dream world? This cannot be undone.")) {
        localStorage.removeItem(STORAGE_KEY);
        scenes = [];
        updateSceneDisplay(null);
        renderHistoryGallery();
        console.log("History cleared.");
    }
}

// --- Initialization ---

function init() {
    loadScenes();
    renderHistoryGallery();
    
    generateButton.addEventListener('click', generateNextScene);
    clearHistoryButton.addEventListener('click', clearHistory);
    
    // Initial state check
    if (scenes.length === 0) {
        noScenesMessage.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});