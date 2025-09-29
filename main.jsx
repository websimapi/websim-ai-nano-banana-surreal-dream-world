import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket } from "websim-database";
import { useSyncExternalStore } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import { Player } from "@websim/remotion/player";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
const room = new WebsimSocket();
const SCENE_COLLECTION = "dream_scene_v1";
const BASE_PROMPT = `A surreal, dreamlike anime-inspired world where human figures constantly morph and dissolve into abstract fractal textures and glowing pastel dreamscapes. Faces with delicate features distort and shift like hallucinations, blending with ghostly overlays, glitch artifacts, neon accents, and painterly brushstrokes. The environment flows around the characters as if alive, with fluid transitions, soft light halos, and chromatic aberrations creating a hypnotic, unsettling yet beautiful atmosphere. Cinematic lighting, highly detailed, octane render, 8K.`;
const useSceneStore = (collection) => {
  const sceneCollection = room.collection(collection);
  const getSnapshot = useCallback(() => {
    return sceneCollection.getList().slice().reverse();
  }, [sceneCollection]);
  const subscribe = useCallback((callback) => {
    return sceneCollection.subscribe(callback);
  }, [sceneCollection]);
  const scenes = useSyncExternalStore(subscribe, getSnapshot);
  return scenes.map((scene, index) => ({
    ...scene,
    localId: index + 1
  }));
};
async function urlToDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to convert URL to Data URL:", e);
    return null;
  }
}
const HistoryThumbnail = React.memo(({ scene, activeLocalId, onClick }) => {
  return /* @__PURE__ */ jsxDEV(
    "img",
    {
      src: scene.imageUrl,
      alt: `Scene ${scene.localId} by ${scene.username}`,
      className: `history-thumbnail ${scene.localId === activeLocalId ? "active" : ""}`,
      onClick: () => onClick(scene.localId),
      title: `Scene ${scene.localId} created by ${scene.username}`
    },
    void 0,
    false,
    {
      fileName: "<stdin>",
      lineNumber: 69,
      columnNumber: 9
    }
  );
});
const App = () => {
  const scenes = useSceneStore(SCENE_COLLECTION);
  const [alterationText, setAlterationText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeLocalId, setActiveLocalId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeScene = useMemo(() => {
    if (activeLocalId !== null) {
      return scenes.find((s) => s.localId === activeLocalId);
    }
    return scenes.length > 0 ? scenes[scenes.length - 1] : null;
  }, [scenes, activeLocalId]);
  useEffect(() => {
    if (scenes.length > 0 && !isPlaying) {
      if (activeScene === null || scenes[scenes.length - 1].localId !== activeLocalId) {
        setActiveLocalId(scenes[scenes.length - 1].localId);
      }
    } else if (scenes.length === 0) {
      setActiveLocalId(null);
    }
  }, [scenes, isPlaying, activeScene, activeLocalId]);
  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;
    if (activeLocalId === scenes[scenes.length - 1].localId || activeLocalId === null || activeLocalId > scenes.length) {
      setActiveLocalId(scenes[0].localId);
      return;
    }
    const nextSceneId = activeLocalId + 1;
    const delay = 3e3;
    if (nextSceneId <= scenes.length) {
      const timer = setTimeout(() => {
        setActiveLocalId(nextSceneId);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsPlaying(false);
      setActiveLocalId(scenes[scenes.length - 1].localId);
    }
  }, [isPlaying, activeLocalId, scenes]);
  const handlePlayFromBeginning = () => {
    if (scenes.length === 0) return;
    setIsPlaying(true);
    setActiveLocalId(scenes[0].localId);
  };
  const handleStopPlayback = () => {
    setIsPlaying(false);
    if (scenes.length > 0) {
      setActiveLocalId(scenes[scenes.length - 1].localId);
    }
  };
  const generateNextScene = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    handleStopPlayback();
    try {
      const lastScene = scenes[scenes.length - 1];
      let imageInputs = [];
      let prompt = BASE_PROMPT;
      let previousSceneId = null;
      if (lastScene) {
        previousSceneId = lastScene.id;
        console.log(`Using previous scene (ID: ${lastScene.id}) as image input.`);
        const dataUrl = await urlToDataUrl(lastScene.imageUrl);
        if (dataUrl) {
          imageInputs.push({ url: dataUrl });
        } else {
          console.warn("Could not get data URL for previous scene. Generating from text prompt only.");
        }
      }
      let alteration = alterationText.trim();
      if (alteration) {
        prompt = `${BASE_PROMPT}. Alteration requested: ${alteration}`;
        console.log("Altering prompt with user text:", alteration);
      }
      const generationParams = {
        prompt,
        aspect_ratio: "16:9"
      };
      if (imageInputs.length > 0) {
        generationParams.image_inputs = imageInputs;
      }
      console.log("Sending generation request...");
      const result = await websim.imageGen(generationParams);
      await room.collection(SCENE_COLLECTION).create({
        imageUrl: result.url,
        basePrompt: BASE_PROMPT,
        alterationText: alteration || null,
        previousSceneId
      });
      setAlterationText("");
    } catch (error) {
      console.error("AI Image Generation failed:", error);
      alert("Failed to generate scene. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };
  const clearHistory = async () => {
    if (!confirm("Are you sure you want to erase all scenes you contributed? This is permanent.")) {
      return;
    }
    setIsGenerating(true);
    handleStopPlayback();
    const currentUser = await websim.getCurrentUser();
    const currentScenes = room.collection(SCENE_COLLECTION).getList();
    let deletedCount = 0;
    await Promise.all(currentScenes.map(async (scene) => {
      if (scene.username === currentUser.username) {
        try {
          await room.collection(SCENE_COLLECTION).delete(scene.id);
          deletedCount++;
        } catch (e) {
        }
      }
    }));
    console.log(`Attempted to clear history. Successfully deleted ${deletedCount} scenes created by you.`);
    setIsGenerating(false);
  };
  const [isComposing, setIsComposing] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const handleComposeClip = () => {
    if (scenes.length < 2) {
      alert("Need at least two scenes to compose a clip.");
      return;
    }
    handleStopPlayback();
    setShowPlayer(true);
  };
  const handleClosePlayer = () => {
    setShowPlayer(false);
  };
  return /* @__PURE__ */ jsxDEV("main", { children: [
    /* @__PURE__ */ jsxDEV("div", { id: "scene-display", children: [
      activeScene ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV(
          "img",
          {
            id: "current-image",
            src: activeScene.imageUrl,
            alt: "Generated Dream Scene"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 277,
            columnNumber: 25
          }
        ),
        /* @__PURE__ */ jsxDEV("div", { className: "current-scene-info", children: [
          /* @__PURE__ */ jsxDEV("p", { children: [
            /* @__PURE__ */ jsxDEV("strong", { children: [
              "Scene ",
              activeScene.localId
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 283,
              columnNumber: 32
            }),
            " by ",
            activeScene.username,
            " (Created: ",
            new Date(activeScene.created_at).toLocaleTimeString(),
            ")"
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 283,
            columnNumber: 29
          }),
          activeScene.alterationText && /* @__PURE__ */ jsxDEV("p", { children: [
            "Alteration: ",
            /* @__PURE__ */ jsxDEV("em", { children: [
              '"',
              activeScene.alterationText,
              '"'
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 284,
              columnNumber: 75
            })
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 284,
            columnNumber: 60
          })
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 282,
          columnNumber: 25
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 276,
        columnNumber: 21
      }) : /* @__PURE__ */ jsxDEV("p", { id: "no-scenes-message", children: "Click 'Generate Next Scene' to begin your journey." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 288,
        columnNumber: 21
      }),
      isGenerating && /* @__PURE__ */ jsxDEV("div", { id: "loading-overlay", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "spinner" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 293,
          columnNumber: 25
        }),
        /* @__PURE__ */ jsxDEV("p", { children: "Generating the next layer of reality..." }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 294,
          columnNumber: 25
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 292,
        columnNumber: 21
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 274,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV("div", { id: "controls", children: [
      /* @__PURE__ */ jsxDEV("div", { id: "generation-input-group", children: [
        /* @__PURE__ */ jsxDEV("label", { htmlFor: "alteration-input", children: "Influence the next frame (Optional):" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 301,
          columnNumber: 21
        }),
        /* @__PURE__ */ jsxDEV(
          "textarea",
          {
            id: "alteration-input",
            value: alterationText,
            onChange: (e) => setAlterationText(e.target.value),
            placeholder: "e.g., 'Now the figure turns into a flock of neon butterflies.'",
            rows: "2",
            disabled: isGenerating || isPlaying
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 302,
            columnNumber: 21
          }
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 300,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("div", { id: "action-buttons", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            id: "generate-button",
            onClick: generateNextScene,
            disabled: isGenerating || isPlaying,
            children: isGenerating ? "Generating... (Wait ~10s)" : "Generate Next Scene"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 313,
            columnNumber: 21
          }
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            id: "play-button",
            onClick: isPlaying ? handleStopPlayback : handlePlayFromBeginning,
            disabled: isGenerating || scenes.length === 0,
            className: "secondary",
            children: isPlaying ? "Stop Playback" : "Play from Beginning"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 321,
            columnNumber: 21
          }
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            id: "compose-clip-button",
            onClick: handleComposeClip,
            disabled: isGenerating || scenes.length < 2,
            className: "secondary",
            children: "Compose as Clip"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 330,
            columnNumber: 21
          }
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            id: "clear-history-button",
            onClick: clearHistory,
            disabled: isGenerating || scenes.length === 0,
            className: "secondary",
            children: "Clear My Contributions"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 339,
            columnNumber: 21
          }
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 312,
        columnNumber: 17
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 299,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV("section", { id: "scene-history", children: [
      /* @__PURE__ */ jsxDEV("h2", { children: [
        "History (",
        scenes.length,
        " Scenes)"
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 351,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("div", { id: "history-gallery", children: [
        scenes.length === 0 && /* @__PURE__ */ jsxDEV("p", { id: "history-empty-message", children: "History will appear here." }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 354,
          columnNumber: 25
        }),
        scenes.map((scene) => /* @__PURE__ */ jsxDEV(
          HistoryThumbnail,
          {
            scene,
            activeLocalId,
            onClick: (localId) => {
              handleStopPlayback();
              setActiveLocalId(localId);
            }
          },
          scene.id,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 357,
            columnNumber: 25
          }
        ))
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 352,
        columnNumber: 17
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 350,
      columnNumber: 13
    }),
    showPlayer && /* @__PURE__ */ jsxDEV(
      RemotionPlayer,
      {
        scenes,
        onClose: handleClosePlayer
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 371,
        columnNumber: 17
      }
    )
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 273,
    columnNumber: 9
  });
};
const ClipComposition = ({ scenes }) => {
  const { fps } = useVideoConfig();
  const sceneDurationFrames = 2 * fps;
  const transitionDurationFrames = 0.5 * fps;
  const validScenes = scenes.filter((s) => s.imageUrl);
  return /* @__PURE__ */ jsxDEV(AbsoluteFill, { style: { backgroundColor: "#0d0d1a" }, children: /* @__PURE__ */ jsxDEV(TransitionSeries, { children: validScenes.map((scene, index) => /* @__PURE__ */ jsxDEV(React.Fragment, { children: [
    /* @__PURE__ */ jsxDEV(TransitionSeries.Sequence, { durationInFrames: sceneDurationFrames, children: /* @__PURE__ */ jsxDEV(SceneFrame, { scene }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 396,
      columnNumber: 29
    }) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 395,
      columnNumber: 25
    }),
    index < validScenes.length - 1 && /* @__PURE__ */ jsxDEV(
      TransitionSeries.Transition,
      {
        timing: linearTiming({ durationInFrames: transitionDurationFrames }),
        presentation: fade()
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 400,
        columnNumber: 29
      }
    )
  ] }, scene.id, true, {
    fileName: "<stdin>",
    lineNumber: 394,
    columnNumber: 21
  })) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 392,
    columnNumber: 13
  }) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 391,
    columnNumber: 9
  });
};
const SceneFrame = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ jsxDEV(AbsoluteFill, { children: [
    /* @__PURE__ */ jsxDEV(
      Img,
      {
        src: scene.imageUrl,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity
        }
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 425,
        columnNumber: 13
      }
    ),
    /* @__PURE__ */ jsxDEV(AbsoluteFill, { style: {
      padding: "30px",
      justifyContent: "flex-end",
      alignItems: "flex-start",
      opacity,
      backgroundColor: "rgba(0, 0, 0, 0.4)"
    }, children: [
      /* @__PURE__ */ jsxDEV("h2", { style: { color: "#88eeff", fontSize: "40px", margin: 0, textShadow: "0 0 8px #88eeff" }, children: [
        "Scene ",
        scene.localId
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 442,
        columnNumber: 17
      }),
      scene.alterationText && /* @__PURE__ */ jsxDEV("p", { style: { color: "white", fontSize: "28px", margin: "5px 0" }, children: scene.alterationText }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 446,
        columnNumber: 21
      }),
      /* @__PURE__ */ jsxDEV("p", { style: { color: "#ccddff", fontSize: "20px", margin: "5px 0" }, children: [
        "Contributed by: ",
        scene.username
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 450,
        columnNumber: 17
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 435,
      columnNumber: 13
    })
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 424,
    columnNumber: 9
  });
};
const RemotionPlayer = ({ scenes, onClose }) => {
  const fps = 30;
  const sceneDurationFrames = 2 * fps;
  const transitionDurationFrames = 0.5 * fps;
  const numScenes = scenes.filter((s) => s.imageUrl).length;
  if (numScenes < 2) return null;
  const totalDurationInFrames = numScenes * sceneDurationFrames + (numScenes - 1) * transitionDurationFrames;
  return /* @__PURE__ */ jsxDEV("div", { style: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center"
  }, children: [
    /* @__PURE__ */ jsxDEV(
      "button",
      {
        onClick: onClose,
        style: {
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 101,
          backgroundColor: "#ff00aa",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer"
        },
        children: "Close Player"
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 484,
        columnNumber: 13
      }
    ),
    /* @__PURE__ */ jsxDEV("div", { style: { maxWidth: "90%", width: "100%", aspectRatio: "16/9", border: "5px solid #ff00ff" }, children: /* @__PURE__ */ jsxDEV(
      Player,
      {
        component: ClipComposition,
        durationInFrames: totalDurationInFrames,
        fps,
        compositionWidth: 1920,
        compositionHeight: 1080,
        inputProps: { scenes },
        controls: true,
        autoplay: true,
        loop: false,
        style: { width: "100%", height: "100%" }
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 502,
        columnNumber: 17
      }
    ) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 501,
      columnNumber: 13
    })
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 471,
    columnNumber: 9
  });
};
createRoot(document.getElementById("app")).render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 521,
  columnNumber: 51
}));
