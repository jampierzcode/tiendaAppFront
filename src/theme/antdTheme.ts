import type { ThemeConfig } from "antd";

/**
 * Ant Design alineado con la paleta de Peacky.
 *
 * Sin esto el panel queda con dos identidades a la vez: los componentes de
 * Antd en su azul de fábrica y todo lo demás en violeta.
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: "#5b2be8",
    colorInfo: "#5b2be8",
    colorSuccess: "#12805c",
    colorWarning: "#9a6206",
    colorError: "#c0263a",

    colorText: "#151243",
    colorTextSecondary: "#4b4870",
    colorTextTertiary: "#7c7a9c",
    colorBorder: "#e6e6f2",
    colorBorderSecondary: "#f0f0f8",
    colorBgLayout: "#f5f6fc",

    fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,

    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,

    controlHeight: 38,
    // Sombras suaves: en un panel denso, una sombra fuerte por componente
    // convierte la pantalla en un relieve ilegible.
    boxShadow: "0 1px 2px rgb(21 18 67 / 0.06)",
    boxShadowSecondary: "0 8px 24px rgb(21 18 67 / 0.10)",
  },

  components: {
    Button: {
      fontWeight: 600,
      primaryShadow: "none",
      defaultShadow: "none",
    },
    Table: {
      headerBg: "#faf9ff",
      headerColor: "#4b4870",
      headerSplitColor: "transparent",
      rowHoverBg: "#f7f5ff",
      cellPaddingBlock: 14,
      borderColor: "#f0f0f8",
    },
    Modal: {
      titleFontSize: 17,
      borderRadiusLG: 16,
    },
    Card: {
      borderRadiusLG: 14,
    },
    Input: {
      paddingBlock: 7,
    },
    Select: {
      optionSelectedBg: "#f0eefe",
    },
    Tabs: {
      itemSelectedColor: "#5b2be8",
      inkBarColor: "#5b2be8",
      titleFontSize: 14,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Segmented: {
      itemSelectedBg: "#5b2be8",
      itemSelectedColor: "#ffffff",
      trackBg: "#f0f0f8",
    },
  },
};
