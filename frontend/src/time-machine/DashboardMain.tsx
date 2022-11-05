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
import Api, { SnapshotTask } from "./Api";
import PauseIcon from "@rsuite/icons/legacy/Pause";
import FileTextIcon from "@rsuite/icons/legacy/FileText";
import PlayIcon from "@rsuite/icons/legacy/Play";
import PlayOutlineIcon from "@rsuite/icons/PlayOutline";
import PauseOutlineIcon from "@rsuite/icons/PauseOutline";
import CloseOutlineIcon from "@rsuite/icons/CloseOutline";
import EditIcon from "@rsuite/icons/Edit";
import AddOutlineIcon from "@rsuite/icons/AddOutline";
import HelpOutlineIcon from "@rsuite/icons/HelpOutline";
import DashboardSnapshot from "./DashboardSnapshot";
import { useTranslation } from "react-i18next";

type EditModelState = {
  mode: "edit" | "create";
  shareLink?: string;
  interval?: number;
};

const MainStatusPanelContent: React.FC<{
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  snapshotTask: SnapshotTask | null;
  setOpenEditModel: (isOpen: boolean) => void;
  setEditModelState: (state: EditModelState) => void;
  loadData: () => Promise<void>;
}> = ({
  isLoading,
  setIsLoading,
  snapshotTask,
  setOpenEditModel,
  setEditModelState,
  loadData,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <Placeholder.Paragraph />;
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
            {t("add-data-source")}
          </IconButton>
        </div>
      );
    } else {
      let StatusIcon = PlayOutlineIcon;
      let statusIconColor = "#53B13A";
      let statusText = t("sync-status-running");
      const nextSyncMsg =
        t("sync-next-sync-message") +
        (snapshotTask.lastSuccessSync
          ? moment(snapshotTask.lastSuccessSync).fromNow()
          : t("sync-next-sync-message-none"));
      if (snapshotTask.status == "Paused") {
        StatusIcon = PauseOutlineIcon;
        statusIconColor = "#575657";
        statusText = t("sync-status-paused");
      } else if (snapshotTask.status == "Stopped") {
        StatusIcon = CloseOutlineIcon;
        statusIconColor = "#D0342C";
        statusText = t("sync-status-stopped");
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
                <a href={snapshotTask.source.OneDrive.shareUrl} target="_blank">
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
                      {t("sync-button-pause")}
                    </IconButton>
                  ) : (
                    <IconButton
                      icon={<PlayIcon />}
                      placement="right"
                      onClick={() => {
                        updateStatus("Running");
                      }}
                    >
                      {t("sync-button-start")}
                    </IconButton>
                  )}
                  <IconButton disabled icon={<FileTextIcon />} placement="left">
                    {t("sync-button-view-Log")}
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
                    {t("sync-button-edit")}
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

function DashboardMain() {
  const { t } = useTranslation();
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

  const [editModelState, setEditModelState] = useState<EditModelState>({
    mode: "create",
  });

  const [openEditModel, setOpenEditModel] = useState(false);

  const allowedInterval = [
    6 * 60,
    8 * 60,
    12 * 60,
    24 * 60,
    2 * 24 * 60,
    7 * 24 * 60,
  ].map((value) => ({
    label: moment.duration(value, "minutes").humanize(),
    value: value,
  }));

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
      <Notification
        type={"error"}
        header={t("error-title")}
        closable
        duration={0}
      >
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
          errorToaster.push(errorNotification(t("error-data-share-link")), {
            placement: "topCenter",
          });
        } else if (res.error == "invalid_folder_structure") {
          errorToaster.push(
            errorNotification(t("error-data-folder-structure")),
            { placement: "topCenter" }
          );
        } else {
          errorToaster.push(
            errorNotification(
              t("error-unknown") + ": " + String(res.unknownError)
            ),
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
        errorNotification(t("error-unknown") + ": " + String(res.unknownError)),
        { placement: "topCenter" }
      );
    }
    setEditButtonLoading(false);
  };

  return (
    <>
      <Panel bordered>
        <div style={{ height: "120px" }}>
          <MainStatusPanelContent
            {...{
              isLoading,
              setIsLoading,
              snapshotTask,
              setOpenEditModel,
              setEditModelState,
              loadData,
            }}
          />
        </div>
      </Panel>
      <DashboardSnapshot />

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
              ? t("edit-data-source")
              : t("add-data-source")}
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
              <Form.ControlLabel>{t("data-source-title")}</Form.ControlLabel>
              <Form.Control
                name="sourceType"
                accepter={SelectPicker}
                data={sourceType}
                cleanable={false}
                searchable={false}
              />
              <InputGroup style={{ marginTop: "8px" }}>
                <InputGroup.Addon>{t("data-share-link")}</InputGroup.Addon>
                <Form.Control name="shareLink" />
              </InputGroup>
              <div style={{ textAlign: "right" }}>
                <HelpOutlineIcon style={{ fontSize: "1.1em" }} />
                {t("data-share-link-help")}
              </div>
            </Form.Group>
            <Form.Group controlId="group-interval">
              <Form.ControlLabel>{t("data-sync-interval")}</Form.ControlLabel>
              <Form.Control
                name="interval"
                accepter={SelectPicker}
                label={t("data-share-link-every")}
                data={allowedInterval}
                cleanable={false}
                searchable={false}
              />
            </Form.Group>

            {editModelState.mode == "create" && (
              <Message showIcon type={"info"} header={t("data-disclaimer")}>
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
                    {t("data-form-submit")}
                  </Button>

                  {editModelState.mode == "edit" && (
                    <Button
                      appearance="primary"
                      color="red"
                      loading={editButtonLoading}
                      onClick={handleDelete}
                    >
                      {t("data-form-delete")}
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

export default DashboardMain;
