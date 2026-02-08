import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { AlertType, AlertButton } from '../components/CustomAlert';

interface AlertConfig {
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
}

interface AlertContextType {
    alertProps: {
        visible: boolean;
        type: AlertType;
        title: string;
        message?: string;
        buttons?: AlertButton[];
        onClose: () => void;
    };
    showAlert: (config: AlertConfig) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
    const [visible, setVisible] = useState(false);

    const hideAlert = useCallback(() => {
        setVisible(false);
        // Clear config after animation
        setTimeout(() => setAlertConfig(null), 300);
    }, []);

    const showAlert = useCallback((config: AlertConfig) => {
        console.log('[ALERT_CONTEXT] showAlert called:', config);
        setAlertConfig(config);
        setVisible(true);
    }, []);

    const value = {
        alertProps: {
            visible,
            type: alertConfig?.type || 'info',
            title: alertConfig?.title || '',
            message: alertConfig?.message,
            buttons: alertConfig?.buttons,
            onClose: hideAlert,
        },
        showAlert,
        hideAlert,
    };

    return (
        <AlertContext.Provider value={value}>
            {children}
        </AlertContext.Provider>
    );
}

export function useAlertContext() {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error('useAlertContext must be used within an AlertProvider');
    }
    return context;
}
