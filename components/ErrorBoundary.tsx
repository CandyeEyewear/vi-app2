/**
 * Error Boundary Component
 * Catches React errors and displays a friendly error screen
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, AppState, AppStateStatus } from 'react-native';
import { Colors } from '../constants/colors';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  private appStateSubscription: any = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  componentDidMount() {
    // Use React Native's AppState instead of window events
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  componentWillUnmount() {
    // Clean up AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }

  handleAppStateChange = (nextAppState: AppStateStatus) => {
    // Optionally reset errors when app comes to foreground
    // This can help recover from transient errors
    if (nextAppState === 'active' && this.state.hasError) {
      // You can uncomment this if you want auto-recovery on app state change
      // this.handleReset();
    }
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Error Info:', errorInfo);
    }

    // In production, you could send this to Sentry or another error tracking service
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = React.useState(false);

  const handleGoHome = () => {
    onReset();
    router.replace('/(tabs)/feed');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconContainer}>
          <AlertTriangle size={64} color={Colors.light.error} />
        </View>

        <Text style={styles.title}>Oops! Something went wrong</Text>
        <Text style={styles.message}>
          We're sorry for the inconvenience. The app encountered an unexpected error.
        </Text>

        {__DEV__ && error && (
          <View style={styles.errorContainer}>
            <TouchableOpacity
              onPress={() => setShowDetails(!showDetails)}
              style={styles.detailsButton}
            >
              <Text style={styles.detailsButtonText}>
                {showDetails ? 'Hide' : 'Show'} Error Details
              </Text>
            </TouchableOpacity>

            {showDetails && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error:</Text>
                <Text style={styles.errorText}>{error.toString()}</Text>

                {errorInfo && errorInfo.componentStack && (
                  <>
                    <Text style={styles.errorTitle}>Component Stack:</Text>
                    <Text style={styles.errorText}>{errorInfo.componentStack}</Text>
                  </>
                )}

                {error.stack && (
                  <>
                    <Text style={styles.errorTitle}>Stack Trace:</Text>
                    <Text style={styles.errorText}>{error.stack}</Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleGoHome}>
            <Home size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Go Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onReset}>
            <RefreshCw size={20} color={Colors.light.primary} />
            <Text style={styles.secondaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorContainer: {
    width: '100%',
    marginBottom: 24,
  },
  detailsButton: {
    padding: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailsButtonText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorDetails: {
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.light.error,
    marginTop: 12,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  secondaryButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

// Export as functional component wrapper for hooks support
export default function ErrorBoundary({ children, fallback }: Props) {
  return <ErrorBoundaryClass fallback={fallback}>{children}</ErrorBoundaryClass>;
}

