import { Container } from "@mui/material";
import React from "react";
export default class ErrorBoundary extends React.Component {

  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error : null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true,
      error : error
    };
  }

  componentDidCatch(error, errorInfo) {
    console.log(error);
    console.log(errorInfo);
  }

  render() {
    if ( this.state.hasError ) {
      return (<>
      <Container>
      <h1 className="errorTitle">Runtime with problems:</h1>
      <div className="errorDetail">{this.state.error.stack}</div>
      </Container>
      </>);
    }
    return this.props.children; 
  }
}