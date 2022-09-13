import { useState, useEffect } from "react";
import moment from "moment";
import {
  Button,
  Modal,
  Panel,
  Placeholder,
  ButtonToolbar,
  Stack,
  Tag,
  IconButton,
  Form,
  SelectPicker,
  InputGroup,
  Message,
  useToaster,
  Notification,
} from "rsuite";
import Api, { SnapshotTask } from "./api";
import PauseIcon from "@rsuite/icons/legacy/Pause";
import FileTextIcon from "@rsuite/icons/legacy/FileText";
import PlayIcon from "@rsuite/icons/legacy/Play";
import PlayOutlineIcon from "@rsuite/icons/PlayOutline";
import PauseOutlineIcon from "@rsuite/icons/PauseOutline";
import CloseOutlineIcon from "@rsuite/icons/CloseOutline";
import EditIcon from "@rsuite/icons/Edit";
import AddOutlineIcon from "@rsuite/icons/AddOutline";
import HelpOutlineIcon from "@rsuite/icons/HelpOutline";

function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [snapshotTask, setSnapshotTask] = useState<SnapshotTask | null>(null);
  const loadData = async () => {
    setIsLoading(true);
    const result = await Api.getSnapshotTask();
    if (result.ok) {
      setSnapshotTask(result.ok == "none" ? null : result.ok);
    } else {
      console.log(result);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const [editModelState, setEditModelState] = useState<{
    mode: "edit" | "create";
    shareLink?: string;
    interval?: number;
  }>({ mode: "create" });

  const [openEditModel, setOpenEditModel] = useState(false);

  const renderDetail = () => {
    if (isLoading) {
      return;
      <Placeholder.Paragraph />;
    } else {
      if (!snapshotTask) {
        return (
          <div
            style={{
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <IconButton
              icon={<AddOutlineIcon />}
              appearance="primary"
              color="green"
              placement="left"
              onClick={() => {
                setOpenEditModel(true);
                setEditModelState({ mode: "create" });
              }}
            >
              Add data source
            </IconButton>
          </div>
        );
      } else {
        let StatusIcon = PlayOutlineIcon;
        let statusIconColor = "#53B13A";
        let statusText = "Running";
        /* TODO: moment i18n */
        let nextSyncMsg =
          "Next sync: " + moment(snapshotTask.nextSync).fromNow();
        if (snapshotTask.status == "Paused") {
          StatusIcon = PauseOutlineIcon;
          statusIconColor = "#575657";
          statusText = "Paused";
          nextSyncMsg = "\u00A0";
        } else if (snapshotTask.status == "Stopped") {
          StatusIcon = CloseOutlineIcon;
          statusIconColor = "#D0342C";
          statusText = "Stopped";
          nextSyncMsg = "\u00A0";
        }

        const updateStatus = async (status: "Running" | "Paused") => {
          setIsLoading(true);
          const res = await Api.updateSnapshotTask(null, status, null);
          if (res.ok != "ok") {
            console.log(res);
          }
          await loadData();
        };

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
                  <a
                    href={snapshotTask.source.OneDrive.shareUrl}
                    target="_blank"
                  >
                    <Tag color="blue">OneDrive</Tag>
                  </a>
                </Stack>
                <>{nextSyncMsg}</>
                <div style={{ marginTop: "20px" }}>
                  <ButtonToolbar>
                    {snapshotTask.status == "Running" ? (
                      <IconButton
                        icon={<PauseIcon />}
                        placement="left"
                        onClick={() => {
                          updateStatus("Paused");
                        }}
                      >
                        Pause
                      </IconButton>
                    ) : (
                      <IconButton
                        icon={<PlayIcon />}
                        placement="right"
                        onClick={() => {
                          updateStatus("Running");
                        }}
                      >
                        Start
                      </IconButton>
                    )}
                    <IconButton icon={<FileTextIcon />} placement="left">
                      View Log
                    </IconButton>
                    <IconButton
                      icon={<EditIcon />}
                      placement="left"
                      onClick={() => {
                        setOpenEditModel(true);
                        setEditModelState({
                          mode: "edit",
                          shareLink: snapshotTask.source.OneDrive.shareUrl,
                          interval: snapshotTask.interval,
                        });
                      }}
                    >
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

  const allowedInterval = [
    ["6 hours", 6 * 60],
    ["8 hours", 8 * 60],
    ["12 hours", 12 * 60],
    ["1 day", 24 * 60],
    ["2 days", 2 * 24 * 60],
    ["1 week", 7 * 24 * 60],
  ].map(([label, value]) => ({ label, value: value }));

  const sourceType = [["OneDrive", "onedrive"]].map(([label, value]) => ({
    label,
    value: value,
  }));

  const [editFormValue, setEditFormValue] = useState({
    shareLink: "",
    interval: 720,
    sourceType: "onedrive",
  });

  const errorToaster = useToaster();
  const errorNotification = (msg: string) => {
    return (
      <Notification type={"error"} header={"Error"} closable duration={0}>
        {msg}
      </Notification>
    );
  };

  const [editButtonLoading, setEditButtonLoading] = useState(false);
  let editFormDefaultValue: {
    interval: number;
    shareLink: string;
    sourceType: string;
  };
  if (editModelState.mode == "edit") {
    editFormDefaultValue = {
      interval: editModelState.interval!,
      shareLink: editModelState.shareLink!,
      sourceType: "onedrive",
    };
  } else {
    editFormDefaultValue = {
      interval: editFormValue.interval!,
      shareLink: editFormValue.shareLink!,
      sourceType: "onedrive",
    };
  }

  const handleSubmit = async (checkStatus: boolean) => {
    setEditButtonLoading(true);
    if (checkStatus) {
      let res;
      if (editModelState.mode == "create") {
        res = await Api.createSnapshotTask(
          editFormValue.interval,
          editFormValue.shareLink
        );
      } else {
        const interval =
          editFormDefaultValue.interval == editFormValue.interval
            ? null
            : editFormValue.interval;
        const shareLink =
          editFormDefaultValue.shareLink == editFormValue.shareLink
            ? null
            : editFormValue.shareLink;
        console.log(interval, shareLink);
        if (interval == null && shareLink == null) {
          res = { ok: "ok" };
        } else {
          res = await Api.updateSnapshotTask(interval, null, shareLink);
        }
      }
      if (res.ok) {
        setOpenEditModel(false);
        await loadData();
      } else {
        if (res.error == "invalid_share") {
          errorToaster.push(
            errorNotification("The given share link is invalid"),
            { placement: "topCenter" }
          );
        } else if (res.error == "invalid_folder_structure") {
          errorToaster.push(
            errorNotification(
              "Cannot found the Sync folder created by Fog of World"
            ),
            { placement: "topCenter" }
          );
        } else {
          errorToaster.push(
            errorNotification("Unknown error: " + String(res.unknownError)),
            { placement: "topCenter" }
          );
        }
      }
    }
    setEditButtonLoading(false);
  };

  const handleDelete = async () => {
    setEditButtonLoading(true);
    const res = await Api.deleteSnapshotTask();
    if (res.ok) {
      setOpenEditModel(false);
      await loadData();
    } else {
      errorToaster.push(
        errorNotification("Unknown error: " + String(res.unknownError)),
        { placement: "topCenter" }
      );
    }
    setEditButtonLoading(false);
  };

  return (
    <>
      <Panel bordered>
        <div style={{ height: "120px" }}>{renderDetail()}</div>
      </Panel>

      <Modal
        open={openEditModel}
        onClose={() => {
          setOpenEditModel(false);
        }}
        backdrop={"static"}
      >
        <Modal.Header>
          <Modal.Title>
            {editModelState.mode == "edit"
              ? "Edit data source"
              : "Add data source"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form
            fluid
            onSubmit={handleSubmit}
            formDefaultValue={editFormDefaultValue}
            onChange={(
              formValue: any // eslint-disable-line @typescript-eslint/no-explicit-any
            ) => {
              setEditFormValue(formValue);
            }}
          >
            <Form.Group controlId="group-data-source">
              <Form.ControlLabel>Data source</Form.ControlLabel>
              <Form.Control
                name="sourceType"
                accepter={SelectPicker}
                data={sourceType}
                cleanable={false}
                searchable={false}
              />
              <InputGroup style={{ marginTop: "8px" }}>
                <InputGroup.Addon>Share link</InputGroup.Addon>
                <Form.Control name="shareLink" />
              </InputGroup>
              <div style={{ textAlign: "right" }}>
                <HelpOutlineIcon style={{ fontSize: "1.1em" }} /> How to get
                share link
              </div>
            </Form.Group>
            <Form.Group controlId="group-interval">
              <Form.ControlLabel>Sync interval</Form.ControlLabel>
              <Form.Control
                name="interval"
                accepter={SelectPicker}
                label="every"
                data={allowedInterval}
                cleanable={false}
                searchable={false}
              />
            </Form.Group>

            {editModelState.mode == "create" && (
              <Message showIcon type="info" header="Disclaimer">
                TODO
              </Message>
            )}

            <Modal.Footer style={{ marginTop: "16px" }}>
              <Form.Group>
                <ButtonToolbar>
                  <Button
                    type="submit"
                    appearance="primary"
                    loading={editButtonLoading}
                  >
                    Submit
                  </Button>

                  {editModelState.mode == "edit" && (
                    <Button
                      appearance="primary"
                      color="red"
                      loading={editButtonLoading}
                      onClick={handleDelete}
                    >
                      Delete
                    </Button>
                  )}
                </ButtonToolbar>
              </Form.Group>
            </Modal.Footer>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Dashboard;
