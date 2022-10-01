import { MapRenderer } from "./utils/MapRenderer";
import { useEffect, useState } from "react";
import { createMapFromZip } from "./Import"
import TimeMachineApi from "./utils/TimeMachineApi";

type Props = {
    mapRenderer: MapRenderer;
    initialSnapshotId: number;
    setLoaded(isLoaded: boolean): void;
};

function Viewer(props: Props): JSX.Element {
    const mapRenderer = props.mapRenderer;
    const [snapshotId, setSnapshotId] = useState(props.initialSnapshotId);

    useEffect(() => {
        return;
    }, [snapshotId]);

    const loadSnapshot = async () => {
        const snapshotInfoRes = await TimeMachineApi.getSnapshotInfo(snapshotId);
        if (!snapshotInfoRes.ok) {
            // TODO: error handling
            return;
        }
        const snapshotInfo = snapshotInfoRes.ok;
        // TODO: we should cache the snapshot locally to save bandwidth
        const snapshotRes = await TimeMachineApi.downloadSnapshot(
            snapshotInfo.downloadToken
        );
        if (!snapshotRes.ok) {
            // TODO: error handling
            return;
        }
        const snapshot = snapshotRes.ok;
        const map = await createMapFromZip(snapshot);
        mapRenderer.replaceFogMap(map);
        props.setLoaded(true);
    };


    useEffect(() => {
        loadSnapshot();
    }, []);

    return (
        <>
            <div className="absolute bottom-0 pb-4 z-10 pointer-events-none flex justify-center w-full">
                {/* {toolButtons.map((toolButton) =>
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
        )} */}
            </div>
        </>
    );
}

export default Viewer;
