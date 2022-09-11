import { useState, useEffect } from "react";
import moment from 'moment';
import {
    Panel,
    Placeholder,
    ButtonToolbar,
    Stack,
    Tag,
    IconButton,
} from "rsuite";
import Api, { SnapshotTask } from "./api";
import PauseIcon from "@rsuite/icons/legacy/Pause";
import FileTextIcon from "@rsuite/icons/legacy/FileText";
import PlayIcon from "@rsuite/icons/legacy/Play";
import PlayOutlineIcon from '@rsuite/icons/PlayOutline';
import PauseOutlineIcon from '@rsuite/icons/PauseOutline';
import CloseOutlineIcon from '@rsuite/icons/CloseOutline';
import EditIcon from "@rsuite/icons/Edit";

function Dashboard() {
    const [isLoading, setIsLoading] = useState(false);
    const [snapshotTask, setSnapshotTask] = useState<SnapshotTask | null>(null);
    const loadData = (async () => {
        setIsLoading(true);
        const result = await Api.getSnapshotTask();
        if (result.ok) {
            setSnapshotTask(result.ok);
        } else {
            console.log(result);
        }
        setIsLoading(false);
    });

    useEffect(() => {
        loadData();
    }, []);


    const renderDetail = () => {
        if (isLoading) {
            return;
            <Placeholder.Paragraph />;
        } else {
            if (snapshotTask) {
                let StatusIcon = PlayOutlineIcon;
                let statusIconColor = "#53B13A";
                let statusText = "Running";
                /* TODO: moment i18n */
                let nextSyncMsg = "Next sync: " + moment(snapshotTask.nextSync).fromNow();
                if (snapshotTask.status == "Paused") {
                    StatusIcon = PauseOutlineIcon;
                    statusIconColor = "#575657";
                    statusText = "Paused";
                    nextSyncMsg = '\u00A0';
                } else if (snapshotTask.status == "Stopped") {
                    StatusIcon = CloseOutlineIcon;
                    statusIconColor = "#D0342C";
                    statusText = "Stopped";
                    nextSyncMsg = '\u00A0';
                }

                const updateStatus =
                    async (status: "Running" | "Paused") => {
                        setIsLoading(true);
                        const res = await Api.updateSnapshotTask(null, status, null);
                        if (res.ok != "ok") {
                            console.log(res);
                        }
                        await loadData();
                    }

                return (
                    <Stack spacing={6} alignItems="flex-start">
                        <>
                            <StatusIcon
                                style={{
                                    fontSize: "4em",
                                    color: statusIconColor,
                                    marginTop: "10px",
                                    marginRight: "20px",
                                }}
                            />
                        </>
                        <>
                            <Stack direction="column" alignItems="flex-start">
                                <Stack spacing={12} direction="row">
                                    <h3>{statusText}</h3>
                                    <a href={snapshotTask.source.OneDrive.shareUrl} target="_blank">
                                        <Tag color="blue">OneDrive</Tag>

                                    </a>
                                </Stack>
                                <>{nextSyncMsg}</>
                                <div style={{ marginTop: "20px" }}>
                                    <ButtonToolbar>
                                        {(snapshotTask.status == "Running") ? (
                                            <IconButton icon={<PauseIcon />} placement="left" onClick={() => {
                                                updateStatus("Paused")
                                            }}>
                                                Pause
                                            </IconButton>
                                        ) : (
                                            <IconButton icon={<PlayIcon />} placement="right"
                                                onClick={() => {
                                                    updateStatus("Running")
                                                }}
                                            >
                                                Start
                                            </IconButton>
                                        )}
                                        <IconButton icon={<FileTextIcon />} placement="left">
                                            View Log
                                        </IconButton>
                                        <IconButton icon={<EditIcon />} placement="left">
                                            Edit
                                        </IconButton>
                                    </ButtonToolbar>
                                </div>
                            </Stack>
                        </>
                    </Stack>
                );
            }

        }
    };

    return (
        <Panel bordered style={{ height: "160px" }}>
            {renderDetail()}
        </Panel>
    );
}

export default Dashboard;
