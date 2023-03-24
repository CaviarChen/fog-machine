import { useState, useEffect, useCallback } from "react";
import moment from "moment";
import {
  Button,
  Table,
  Panel,
  Placeholder,
  ButtonToolbar,
  Tooltip,
  Whisper,
  Tag,
  Pagination,
  Notification,
  useToaster,
  Modal,
  Message,
  Stack,
  DatePicker,
  Uploader,
  Form,
  IconButton,
  Input,
  InputGroup,
} from "rsuite";
import VisibleIcon from "@rsuite/icons/Visible";
import FileDownloadIcon from "@rsuite/icons/FileDownload";
import TrashIcon from "@rsuite/icons/Trash";
import PlusIcon from "@rsuite/icons/Plus";
import EditIcon from "@rsuite/icons/Edit";
import MoreIcon from "@rsuite/icons/legacy/More";
import CheckIcon from "@rsuite/icons/Check";
import Api, { SnapshotList, Snapshot } from "./Api";
import { MessageType } from "rsuite/esm/Notification/Notification";
import { useTranslation } from "react-i18next";

const { Column, HeaderCell, Cell } = Table;

type SnapshotListState = {
  currentPage: number;
};

type EditNoteState = {
  activeId: number | null;
  updateNote: string | null;
};

const SnapshotListPanel: React.FC<{
  isLoading: boolean;
  snapshotList: SnapshotList | null;
  snapshotListState: SnapshotListState;
  setSnapshotListState: (state: SnapshotListState) => void;
  openDeleteConfirmation: (snapshotId: number) => void;
  editNoteState: EditNoteState;
  setEditNoteState: (state: EditNoteState) => void;
  loadData: () => void;
}> = ({
  isLoading,
  snapshotList,
  snapshotListState,
  setSnapshotListState,
  openDeleteConfirmation,
  editNoteState,
  setEditNoteState,
  loadData,
}) => {
  const { t } = useTranslation();
  if (!snapshotList) {
    return <Placeholder.Paragraph />;
  } else {
    return (
      <div>
        <Table
          data={snapshotList.snapshots}
          loading={isLoading}
          autoHeight={true}
          id="table"
        >
          <Column flexGrow={6}>
            <HeaderCell>{t("snapshot-list-date")}</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Whisper
                    placement="top"
                    trigger="hover"
                    speaker={
                      <Tooltip>
                        {moment(snapshot.timestamp).format("lll")}
                      </Tooltip>
                    }
                  >
                    <div>{moment(snapshot.timestamp).format("YYYY-MM-DD")}</div>
                  </Whisper>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={10}>
            <HeaderCell>{t("snapshot-list-note")}</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return editNoteState.activeId == snapshot.id ? (
                  <InputGroup inside size="sm">
                    <input
                      className="rs-input"
                      defaultValue={snapshot.note ? snapshot.note : undefined}
                      onChange={(note) => {
                        setEditNoteState({
                          ...editNoteState,
                          updateNote: note.target.value,
                        });
                      }}
                    />
                    <InputGroup.Button
                      onClick={async () => {
                        const res = await Api.editSnapshot(
                          editNoteState.activeId!,
                          editNoteState.updateNote
                        );
                        // TODO: Error handling
                        if (res.ok) {
                          loadData();
                        } else {
                          console.log(res);
                        }
                        setEditNoteState({ activeId: null, updateNote: null });
                      }}
                    >
                      <CheckIcon />
                    </InputGroup.Button>
                  </InputGroup>
                ) : (
                  <div>{snapshot.note}</div>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={6}>
            <HeaderCell>{t("snapshot-list-source")}</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Tag>
                    {snapshot.sourceKind == "Sync"
                      ? t("snapshot-list-source-sync")
                      : t("snapshot-list-source-upload")}
                  </Tag>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={10} fixed="right">
            <HeaderCell>
              <MoreIcon />
            </HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <div style={{ marginTop: "-3px" }}>
                    <ButtonToolbar>
                      <Whisper
                        placement="bottom"
                        controlId="control-id-hover"
                        trigger="hover"
                        speaker={<Tooltip>{t("snapshot-list-view")}</Tooltip>}
                      >
                        <Button
                          size="sm"
                          appearance="subtle"
                          onClick={() => {
                            location.href =
                              "/editor?viewing-snapshot=" + String(snapshot.id);
                          }}
                        >
                          <VisibleIcon />
                        </Button>
                      </Whisper>
                      <Whisper
                        placement="bottom"
                        controlId="control-id-hover"
                        trigger="hover"
                        speaker={
                          <Tooltip>{t("snapshot-list-note-edit")}</Tooltip>
                        }
                      >
                        <Button
                          appearance="subtle"
                          size="sm"
                          onClick={() => {
                            setEditNoteState({
                              activeId: snapshot.id,
                              updateNote: snapshot.note,
                            });
                          }}
                        >
                          <EditIcon />
                        </Button>
                      </Whisper>
                      <Whisper
                        placement="bottom"
                        controlId="control-id-hover"
                        trigger="hover"
                        speaker={
                          <Tooltip>{t("snapshot-list-download")}</Tooltip>
                        }
                      >
                        <Button
                          size="sm"
                          appearance="subtle"
                          onClick={async () => {
                            const token = await Api.getSnapshotDownloadToken(
                              snapshot.id
                            );
                            if (token.ok) {
                              window.open(
                                Api.backendUrl +
                                  "misc/download?token=" +
                                  token.ok,
                                "_blank"
                              );
                            } else {
                              //TODO: error handling
                            }
                          }}
                        >
                          <FileDownloadIcon />
                        </Button>
                      </Whisper>
                      <Whisper
                        placement="bottom"
                        controlId="control-id-hover"
                        trigger="hover"
                        speaker={<Tooltip>{t("snapshot-list-delete")}</Tooltip>}
                      >
                        <Button
                          size="sm"
                          appearance="subtle"
                          onClick={() => openDeleteConfirmation(snapshot.id)}
                        >
                          <TrashIcon />
                        </Button>
                      </Whisper>
                    </ButtonToolbar>
                  </div>
                );
              }}
            </Cell>
          </Column>
        </Table>
        <hr />
        <Pagination
          layout={["total", "-", "pager", "skip"]}
          size={"xs"}
          prev={true}
          next={true}
          first={true}
          last={true}
          limit={10}
          total={snapshotList.numberOfSnapshots}
          maxButtons={4}
          activePage={snapshotListState.currentPage}
          onChangePage={(page) => {
            setSnapshotListState({
              currentPage: page,
            });
          }}
        />
      </div>
    );
  }
};

function DashboardSnapshot() {
  const { t } = useTranslation();
  const [snapshotList, setSnapshotList] = useState<SnapshotList | null>(null);
  const [snapshotListState, setSnapshotListState] = useState<SnapshotListState>(
    {
      currentPage: 1,
    }
  );

  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const result = await Api.listSnapshots(snapshotListState.currentPage, 10);
    if (result.ok) {
      setSnapshotList(result.ok);
    } else {
      console.log(result);
    }
    setIsLoading(false);
  }, [snapshotListState]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // TODO: we should have a single global toaster for all notifications
  const notificationToaster = useToaster();

  const notification = (type: MessageType, msg: string) => {
    return (
      <Message showIcon type={type}>
        {msg}
      </Message>
    );
  };

  const openDeleteConfirmation = (snapshotId: number) => {
    // TODO: It is a bit wierd to use `Notifaction` as a modal. Maybe we shoudln't do this, but it works okish for now.
    // e.g. when `Notifaction` is open, user can still click other things on the page.
    //      no easy way to close the current one other than using `clear` which close all things.
    //      We *SHOULDN'T* allow user to open multiple confirmation, that's really confusing.

    const message = (
      <Notification
        type="warning"
        header={t("snapshot-list-delete-title")}
        closable
        duration={0}
      >
        {t("snapshot-list-delete-prompt")}
        <hr />
        <ButtonToolbar style={{ padding: 10 }}>
          <Button
            appearance="primary"
            onClick={async () => {
              notificationToaster.clear();
            }}
          >
            {t("snapshot-list-delete-cancel")}
          </Button>
          <Button
            color="red"
            appearance="primary"
            onClick={async () => {
              notificationToaster.clear();
              const res = await Api.deleteSnapshot(snapshotId);
              // TODO: Error handling
              if (res.ok) {
                notificationToaster.push(
                  notification("success", t("success-title")),
                  {
                    placement: "topCenter",
                  }
                );
                loadData();
              } else {
                console.log(res);
              }
            }}
          >
            {t("snapshot-list-delete-confirm")}
          </Button>
        </ButtonToolbar>
      </Notification>
    );
    notificationToaster.push(message, {
      placement: "topCenter",
    });
  };

  const fileUploadUrl = Api.backendUrl + "misc/upload";
  const headers = Api.tokenHeaders();

  type UploadDialogState = {
    uploadDate: Date | null;
    uploadNote: string | null;
    uploadState: "empty" | "uploading" | { token: string };
  };
  const [uploadDialogState, setUploadDialogState] = useState<
    UploadDialogState | "closed"
  >("closed");

  const [editNoteState, setEditNoteState] = useState<EditNoteState>({
    activeId: null,
    updateNote: null,
  });

  return (
    <div style={{ marginTop: "2vh" }}>
      <Panel
        header={
          <Stack justifyContent="space-between">
            <span>{t("snapshot-list-title")}</span>
            <IconButton
              icon={<PlusIcon />}
              onClick={() => {
                setUploadDialogState({
                  uploadDate: null,
                  uploadNote: null,
                  uploadState: "empty",
                });
              }}
            >
              {t("snapshot-list-upload")}
            </IconButton>
          </Stack>
        }
      >
        <SnapshotListPanel
          {...{
            isLoading,
            snapshotList,
            snapshotListState,
            setSnapshotListState,
            openDeleteConfirmation,
            editNoteState,
            setEditNoteState,
            loadData,
          }}
        />
      </Panel>

      <Modal
        open={uploadDialogState != "closed"}
        onClose={() => {
          setUploadDialogState("closed");
        }}
        backdrop={"static"}
      >
        <Modal.Header>
          <Modal.Title>{t("data-upload-title")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/*
            TODO: `Uploader` will send the upload request directly. So the file will be uploaded when the user selected the file not when they click the submit button.
            I guess this is fine except that `upload_token` is only valid for 1 min, so if the user click submit after 1 min then this is not going to work.
             */}
            <Uploader
              action={fileUploadUrl}
              headers={headers}
              disableMultipart={true}
              multiple={false}
              disabled={
                uploadDialogState == "closed" ||
                uploadDialogState.uploadState != "empty"
              }
              accept=".zip"
              onUpload={(_files) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "uploading",
                });
              }}
              onRemove={(_file) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "empty",
                });
              }}
              onError={(res, files) => {
                console.log(files);
                console.log(res);
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "empty",
                });
                notificationToaster.push(
                  notification("error", t("error-title"))
                );
              }}
              onSuccess={(res) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: { token: res.upload_token },
                });
              }}
              draggable
            >
              <div
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span>
                  {uploadDialogState == "closed" ||
                  uploadDialogState.uploadState == "empty"
                    ? t("data-upload-prompt")
                    : uploadDialogState.uploadState == "uploading"
                    ? t("data-upload-uploading")
                    : t("data-upload-success")}
                </span>
              </div>
            </Uploader>

            <Modal.Footer style={{ marginTop: "16px" }}>
              <Form.Group>
                <Stack spacing={6} justifyContent={"flex-end"}>
                  <DatePicker
                    format="yyyy-MM-dd HH:mm"
                    size="lg"
                    placeholder={t("data-upload-select-date")}
                    onChange={(date) => {
                      if (uploadDialogState == "closed") return;
                      setUploadDialogState({
                        ...uploadDialogState,
                        uploadDate: date,
                      });
                    }}
                    style={{ width: 200, display: "block", marginBottom: 10 }}
                  />
                  <Input
                    size="lg"
                    style={{ width: 200, display: "block", marginBottom: 10 }}
                    placeholder={t("data-upload-note")}
                    onChange={(note) => {
                      if (uploadDialogState == "closed") return;
                      setUploadDialogState({
                        ...uploadDialogState,
                        uploadNote: note,
                      });
                    }}
                  />
                  <Button
                    style={{ display: "block", marginBottom: 10 }}
                    disabled={
                      uploadDialogState == "closed" ||
                      !uploadDialogState.uploadDate ||
                      uploadDialogState.uploadState == "empty" ||
                      uploadDialogState.uploadState == "uploading"
                    }
                    type="submit"
                    appearance="primary"
                    onClick={async () => {
                      if (
                        uploadDialogState == "closed" ||
                        !uploadDialogState.uploadDate ||
                        uploadDialogState.uploadState == "empty" ||
                        uploadDialogState.uploadState == "uploading"
                      )
                        return;

                      const result = await Api.uploadSnapshot(
                        uploadDialogState.uploadDate,
                        uploadDialogState.uploadState.token,
                        uploadDialogState.uploadNote
                      );

                      if (result.ok) {
                        notificationToaster.push(
                          notification("success", t("success-title"))
                        );
                        setUploadDialogState("closed");
                        loadData();
                      } else {
                        console.log(result);
                        let errorMessage = t("error-unknown");
                        if (result.error == "timestamp_is_in_future") {
                          errorMessage = t("error-upload-timestamp");
                        } else if (result.error == "invalid_upload_token") {
                          errorMessage = t("error-upload-token");
                          // TODO: We should reset the `Uploader` here, but currently this cannot be done because
                          // the way we use the `Uploader` is wrong.
                          // We should: not maintaing our own upload status and use `fileList`.
                          // see this example: https://rsuitejs.com/components/uploader/#controlled
                        }
                        notificationToaster.push(
                          notification("error", errorMessage)
                        );
                      }
                    }}
                  >
                    {t("data-form-submit")}
                  </Button>
                </Stack>
              </Form.Group>
            </Modal.Footer>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default DashboardSnapshot;
