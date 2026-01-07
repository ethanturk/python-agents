import React from "react";
import { Box, Button, Container, Typography, Paper } from "@mui/material";
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  /* eslint-disable-next-line no-unused-vars */
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service here if needed
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="md">
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              py: 4,
            }}
          >
            <Paper
              elevation={3}
              sx={{
                p: 4,
                textAlign: "center",
                maxWidth: "600px",
                width: "100%",
              }}
            >
              <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Oops! Something went wrong
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                We apologize for the inconvenience. The application has
                encountered an unexpected error.
              </Typography>

              {import.meta.env.DEV && this.state.error && (
                <Box
                  sx={{
                    mt: 3,
                    p: 2,
                    bgcolor: "grey.100",
                    borderRadius: 1,
                    textAlign: "left",
                    overflow: "auto",
                    maxHeight: "200px",
                  }}
                >
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{ whiteSpace: "pre-wrap" }}
                  >
                    {this.state.error.toString()}
                    {this.state.errorInfo &&
                      this.state.errorInfo.componentStack}
                  </Typography>
                </Box>
              )}

              <Box
                sx={{
                  mt: 3,
                  display: "flex",
                  gap: 2,
                  justifyContent: "center",
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReset}
                >
                  Try Again
                </Button>
                <Button variant="outlined" onClick={this.handleReload}>
                  Reload Page
                </Button>
              </Box>
            </Paper>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
