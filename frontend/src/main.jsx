import React from "react";
import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css"; // Bootstrap: layout, buttons, forms, utilities
import "bootstrap-icons/font/bootstrap-icons.css"; // icons: <i className="bi bi-send" />
import "./styles.css"; // our own theme on top of Bootstrap
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
