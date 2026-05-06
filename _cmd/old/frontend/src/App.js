import React from "react";
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Or Create your Own theme:
const theme = createTheme({
  palette: {
    primary: {
      main: '#e65100'
    },
    secondary: {
      main: '#333333'
    }
  }
});
    

import Layout from "./pages/Layout.js"
import "./css/App.css"
import ErrorBoundary from "./ErrorBoundary.js";

class App extends React.Component {
  render() {
    return (<>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <ErrorBoundary>
            <Layout/>
          </ErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </>);
  }
}

const container = document.getElementById('app');
const root = createRoot(container);
root.render(<App />);

