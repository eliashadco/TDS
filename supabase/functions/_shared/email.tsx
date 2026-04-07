import React from "npm:react@18.3.1";
import { renderToStaticMarkup } from "npm:react-dom@18.3.1/server";

type NotificationTemplateProps = {
  title: string;
  preheader: string;
  body: string;
  bullets?: string[];
};

function NotificationTemplate({ title, preheader, body, bullets = [] }: NotificationTemplateProps) {
  return React.createElement(
    "html",
    null,
    React.createElement(
      "body",
      {
        style: {
          backgroundColor: "#04070d",
          color: "#d4dce8",
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          margin: 0,
          padding: "24px",
        },
      },
      React.createElement("div", { style: { display: "none", maxHeight: "0", overflow: "hidden", opacity: 0 } }, preheader),
      React.createElement(
        "div",
        {
          style: {
            maxWidth: "560px",
            margin: "0 auto",
            backgroundColor: "#0a1019",
            border: "1px solid #152035",
            borderRadius: "12px",
            padding: "24px",
          },
        },
        React.createElement("h1", { style: { margin: "0 0 12px", fontSize: "20px", color: "#d4dce8" } }, title),
        React.createElement("p", { style: { margin: "0 0 16px", lineHeight: 1.6, color: "#d4dce8" } }, body),
        bullets.length > 0
          ? React.createElement(
              "ul",
              { style: { margin: "0 0 16px", paddingLeft: "20px", color: "#d4dce8" } },
              ...bullets.map((bullet) => React.createElement("li", { key: bullet, style: { marginBottom: "8px" } }, bullet)),
            )
          : null,
        React.createElement("p", { style: { margin: 0, color: "#4a5a72", fontSize: "12px" } }, "Intelligent Investors • Intelligent Trading System"),
      ),
    ),
  );
}

export function renderNotificationEmail(props: NotificationTemplateProps): string {
  return "<!doctype html>" + renderToStaticMarkup(React.createElement(NotificationTemplate, props));
}
