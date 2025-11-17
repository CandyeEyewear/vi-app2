/**
 * Logger Utility
 * Centralized logging that automatically disables in production
 */

import { Platform } from 'react-native';

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private isDev = __DEV__;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${level.toUpperCase()}] ${timestamp}`;
    
    return `${prefix} ${message}`;
  }

  private addLog(level: LogLevel, message: string, data?: any) {
    if (this.isDev) {
      this.logs.push({
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
      });

      // Keep only last maxLogs entries
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
    }
  }

  log(message: string, data?: any) {
    this.addLog('log', message, data);
    if (this.isDev) {
      // Platform.OS check ensures we're in React Native environment
      if (Platform.OS !== 'web' || typeof console !== 'undefined') {
        console.log(this.formatMessage('log', message, data));
      }
    }
  }

  info(message: string, data?: any) {
    this.addLog('info', message, data);
    if (this.isDev) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any) {
    this.addLog('warn', message, data);
    if (this.isDev) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: any) {
    this.addLog('error', message, error);
    if (this.isDev) {
      console.error(this.formatMessage('error', message, error));
    }
    
    // Sentry initialization commented out
    // In production, send errors to Sentry if available
    // try {
    //   const { Sentry } = require('../services/sentry');
    //   if (Sentry && Sentry.captureException) {
    //     Sentry.captureException(error || new Error(message), {
    //       extra: { message },
    //     });
    //   }
    // } catch (e) {
    //   // Sentry not configured or not available
    // }
  }

  debug(message: string, data?: any) {
    this.addLog('debug', message, data);
    if (this.isDev) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  // Get recent logs (useful for debugging)
  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = (message: string, data?: any) => logger.log(message, data);
export const info = (message: string, data?: any) => logger.info(message, data);
export const warn = (message: string, data?: any) => logger.warn(message, data);
export const error = (message: string, error?: any) => logger.error(message, error);
export const debug = (message: string, data?: any) => logger.debug(message, data);

export default logger;

