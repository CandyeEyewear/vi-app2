/**
 * Logger Utility Tests
 * Basic test setup for the logger utility
 */

import { logger, log, info, warn, error, debug } from '../../utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Clear logs before each test
    logger.clearLogs();
  });

  describe('log', () => {
    it('should log a message', () => {
      log('Test message');
      const logs = logger.getLogs('log');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Test message');
    });

    it('should log with data', () => {
      const testData = { key: 'value' };
      log('Test message', testData);
      const logs = logger.getLogs('log');
      expect(logs[0].data).toEqual(testData);
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      info('Info message');
      const logs = logger.getLogs('info');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Info message');
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      warn('Warning message');
      const logs = logger.getLogs('warn');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Warning message');
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      error('Error message');
      const logs = logger.getLogs('error');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Error message');
    });

    it('should log error with error object', () => {
      const testError = new Error('Test error');
      error('Error message', testError);
      const logs = logger.getLogs('error');
      expect(logs[0].data).toBe(testError);
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      debug('Debug message');
      const logs = logger.getLogs('debug');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Debug message');
    });
  });

  describe('getLogs', () => {
    it('should return all logs when no level specified', () => {
      log('Log 1');
      info('Info 1');
      warn('Warn 1');
      const allLogs = logger.getLogs();
      expect(allLogs.length).toBe(3);
    });

    it('should filter logs by level', () => {
      log('Log 1');
      log('Log 2');
      info('Info 1');
      const logLevelLogs = logger.getLogs('log');
      expect(logLevelLogs.length).toBe(2);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      log('Log 1');
      info('Info 1');
      logger.clearLogs();
      const logs = logger.getLogs();
      expect(logs.length).toBe(0);
    });
  });
});

