import Map from "./Map";
import { MapRenderer } from "./utils/MapRenderer";
import { useEffect, useState } from "react";
import Mousetrap from "mousetrap";

type Props = {
  setLoaded(isLoaded: boolean): void;
};

function EditorMode(props: Props): JSX.Element {
  const mapRenderer = MapRenderer.get();
  const [eraserMode, setEraserMode] = useState(false);
  useEffect(() => {
    mapRenderer.setEraserMod(eraserMode);
  }, [eraserMode]);

  const [historyStatus, setHistoryStatus] = useState({
    canRedo: false,
    canUndo: false,
  });

  const mapRendererOnChange = () => {
    setHistoryStatus({
      canRedo: mapRenderer.historyManager.canRedo(),
      canUndo: mapRenderer.historyManager.canUndo(),
    });
  };
  const mapOnLoaded = () => {
    Mousetrap.bind(["mod+z"], (_) => {
      mapRenderer.undo();
    });
    Mousetrap.bind(["mod+shift+z"], (_) => {
      mapRenderer.redo();
    });

    // give deckgl a little bit of time
    setTimeout(() => {
      props.setLoaded(true);
    }, 200);
  };

  const toolButtons = [
    {
      icon: iconUndo,
      clickable: historyStatus.canUndo,
      enabled: false,
      onClick: () => {
        mapRenderer.undo();
      },
    },
    {
      icon: iconRedo,
      clickable: historyStatus.canRedo,
      enabled: false,
      onClick: () => {
        mapRenderer.redo();
      },
    },
    null,
    {
      icon: iconEraserSolid,
      clickable: true,
      enabled: eraserMode,
      onClick: () => {
        setEraserMode(!eraserMode);
      },
    },
  ];

  return (
    <>
      <Map
        setLoaded={props.setLoaded}
        mapOnLoaded={mapOnLoaded}
        mapRendererOnChange={mapRendererOnChange}
      />
      <div className="absolute bottom-0 pb-4 z-10 pointer-events-none flex justify-center w-full">
        {toolButtons.map((toolButton) =>
          toolButton !== null ? (
            <button
              className={
                "flex items-center justify-center mx-2 w-9 h-9 p-2 bg-white shadow rounded-lg hover:bg-gray-200 active:bg-gray-400" +
                (toolButton.enabled ? " ring-4 ring-gray-700" : "") +
                (toolButton.clickable
                  ? " pointer-events-auto"
                  : " text-gray-300 opacity-40")
              }
              onClick={() => {
                if (toolButton.clickable) {
                  toolButton.onClick();
                }
              }}
            >
              {toolButton.icon}
            </button>
          ) : (
            <div
              className={
                "flex items-center justify-center rounded mx-7 w-1 h-9 bg-black shadow"
              }
            ></div>
          )
        )}
      </div>
    </>
  );
}

export default EditorMode;

const iconEraserSolid = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="eraser"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M497.941 273.941c18.745-18.745 18.745-49.137 0-67.882l-160-160c-18.745-18.745-49.136-18.746-67.883 0l-256 256c-18.745 18.745-18.745 49.137 0 67.882l96 96A48.004 48.004 0 0 0 144 480h356c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12H355.883l142.058-142.059zm-302.627-62.627l137.373 137.373L265.373 416H150.628l-80-80 124.686-124.686z"
    ></path>
  </svg>
);

const iconRedo = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="redo"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M500.33 0h-47.41a12 12 0 0 0-12 12.57l4 82.76A247.42 247.42 0 0 0 256 8C119.34 8 7.9 119.53 8 256.19 8.1 393.07 119.1 504 256 504a247.1 247.1 0 0 0 166.18-63.91 12 12 0 0 0 .48-17.43l-34-34a12 12 0 0 0-16.38-.55A176 176 0 1 1 402.1 157.8l-101.53-4.87a12 12 0 0 0-12.57 12v47.41a12 12 0 0 0 12 12h200.33a12 12 0 0 0 12-12V12a12 12 0 0 0-12-12z"
    ></path>
  </svg>
);

const iconUndo = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="undo"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M212.333 224.333H12c-6.627 0-12-5.373-12-12V12C0 5.373 5.373 0 12 0h48c6.627 0 12 5.373 12 12v78.112C117.773 39.279 184.26 7.47 258.175 8.007c136.906.994 246.448 111.623 246.157 248.532C504.041 393.258 393.12 504 256.333 504c-64.089 0-122.496-24.313-166.51-64.215-5.099-4.622-5.334-12.554-.467-17.42l33.967-33.967c4.474-4.474 11.662-4.717 16.401-.525C170.76 415.336 211.58 432 256.333 432c97.268 0 176-78.716 176-176 0-97.267-78.716-176-176-176-58.496 0-110.28 28.476-142.274 72.333h98.274c6.627 0 12 5.373 12 12v48c0 6.627-5.373 12-12 12z"
    ></path>
  </svg>
);
