import React, { useState, Dispatch } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  ButtonGroup,
  Container,
  Panel,
  Content,
  Divider,
  Stack,
  IconButton,
  Badge,
} from "rsuite";
import EditIcon from "@rsuite/icons/Edit";
import HistoryIcon from "@rsuite/icons/History";
import RelatedMapIcon from "@rsuite/icons/RelatedMap";
import { IconProps } from "@rsuite/icons/lib/Icon";
import { Icon } from "@rsuite/icons";
import { useTranslation } from "react-i18next";
import "./Home.css";
import { FiMoon, FiSun } from "react-icons/fi";
import memolanesLogo from "./memolanes_logo.webp";

function Item(
  title: string,
  IconOrImage: React.FC<IconProps> | string,
  description: string,
  className: string,
  onClick: () => void
) {
  const [hover, setHover] = useState(false);
  const isImage = typeof IconOrImage === "string";

  return (
    <Panel
      shaded={hover}
      bordered
      bodyFill
      className={className}
      onClick={() => {
        onClick();
      }}
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
    >
      <Stack spacing={6}>
        {isImage ? (
          <img
            src={IconOrImage}
            alt={title}
            style={{ width: "6em", height: "6em", margin: "20px" }}
          />
        ) : (
          <IconOrImage style={{ fontSize: "6em", margin: "20px" }} />
        )}
        <Panel header={title}>
          <p>
            <small>{description}</small>
          </p>
        </Panel>
      </Stack>
    </Panel>
  );
}

function Home(props: {
  isDarkTheme: boolean;
  setIsDarkTheme: Dispatch<boolean>;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  return (
    <Container>
      <Content>
        <div className="home-body">
          <div className={props.isDarkTheme ? "home-title-dark" : "home-title"}>
            <h1>{t("home-main-title")}</h1>
            <h4>{t("home-main-title-desc")}</h4>
          </div>

          <Divider />

          <div style={{ width: "100%" }}>
            <Stack spacing={20} justifyContent="center">
              <ButtonGroup
                style={{ display: "table", margin: "0 auto" }}
                size="lg"
              >
                <Button
                  active={i18n.resolvedLanguage == "zh"}
                  onClick={() => i18n.changeLanguage("zh")}
                >
                  简体中文
                </Button>
                <Button
                  active={i18n.resolvedLanguage == "en"}
                  onClick={() => i18n.changeLanguage("en")}
                >
                  English
                </Button>
              </ButtonGroup>

              <IconButton
                size="lg"
                icon={
                  props.isDarkTheme ? <Icon as={FiMoon} /> : <Icon as={FiSun} />
                }
                onClick={() => {
                  props.setIsDarkTheme(!props.isDarkTheme);
                }}
              >
                {props.isDarkTheme
                  ? t("home-theme-dark")
                  : t("home-theme-light")}
              </IconButton>
            </Stack>
          </div>

          {Item(
            t("home-editor-title"),
            EditIcon,
            t("home-editor-desc"),
            "home-item",
            () => {
              location.href = "/editor";
            }
          )}
          {Item(
            t("home-time-machine-title"),
            HistoryIcon,
            t("home-time-machine-desc"),
            "home-item",
            () => {
              navigate("/time-machine", { replace: false });
            }
          )}
          <Divider style={{ marginTop: "2vh", marginBottom: "2vh" }} />
          <Badge color="blue" content="AD" style={{ width: "100%" }}>
            {Item(
              t("home-memolanes-title"),
              memolanesLogo,
              t("home-memolanes-desc"),
              "home-ad-item",
              () => {
                location.href = "https://app.memolanes.com/";
              }
            )}
          </Badge>
        </div>
      </Content>
    </Container>
  );
}

export default Home;
