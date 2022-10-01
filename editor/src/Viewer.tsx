import { MapRenderer } from "./utils/MapRenderer";
import { useEffect, useState } from "react";
import { createMapFromZip } from "./Import";
import TimeMachineApi from "./utils/TimeMachineApi";

type Props = {
  mapRenderer: MapRenderer;
  initialSnapshotId: number;
  setLoaded(isLoaded: boolean): void;
  msgboxShow(title: string, msg: string): void;
};

// User may switch between snapshots a lot and the sansphotId -> data mapping should be immutable.
// So let's cache it.
// TODO: improve caching. e.g. size limit / not in memory / share across sessions
const gloablSnapshotCache: { [key: number]: ArrayBuffer } = {};

function Viewer(props: Props): JSX.Element {
  console.log("creating viewer", props);
  const mapRenderer = props.mapRenderer;
  const [snapshotId, setSnapshotId] = useState(props.initialSnapshotId);

  useEffect(() => {
    return;
  }, [snapshotId]);

  const loadSnapshot = async () => {
    props.setLoaded(false);
    const snapshotInfoRes = await TimeMachineApi.getSnapshotInfo(snapshotId);
    if (!snapshotInfoRes.ok) {
      console.log(snapshotInfoRes);
      props.msgboxShow("error", "error-failed-to-load-snapshot");
      return;
    }
    const snapshotInfo = snapshotInfoRes.ok;

    let snapshot;
    if (gloablSnapshotCache[snapshotInfo.id]) {
      snapshot = gloablSnapshotCache[snapshotInfo.id];
    } else {
      const snapshotRes = await TimeMachineApi.downloadSnapshot(
        snapshotInfo.downloadToken
      );
      if (!snapshotRes.ok) {
        console.log(snapshotInfoRes);
        props.msgboxShow("error", "error-failed-to-load-snapshot");
        return;
      }
      snapshot = snapshotRes.ok;
      gloablSnapshotCache[snapshotInfo.id] = snapshot;
    }
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
