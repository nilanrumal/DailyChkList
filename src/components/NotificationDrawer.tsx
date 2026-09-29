import React from 'react';
import { X, Bell, AlertTriangle, CheckCircle2, Info, Volume2, ShieldAlert } from 'lucide-react';
import { NotificationItem } from '../types';
import { playAlertTone, requestPushPermission, sendBrowserPushNotification } from '../services/notifications';
import { addNotification, markNotificationAsRead } from '../services/storage';

interface NotificationDrawerProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSelectBranch?: (branchId: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  notifications,
  isOpen,
  onClose,
  onRefresh,
  onSelectBranch,
}) => {
  if (!isOpen) return null;

  const handleEnablePush = async () => {
    const granted = await requestPushPermission();
    if (granted) {
      sendBrowserPushNotification(
        'Rathna Super Push Alerts Enabled',
        'You will now receive high-priority alerts for critical branch tasks and freezer warnings.'
      );
      playAlertTone('SUCCESS');
    }
  };

  const handleSimulateAlert = () => {
    const branches = ['Mathugama', 'Egoda Uyana', 'Millagashandiya'];
    const chosen = branches[Math.floor(Math.random() * branches.length)];
    const newNotif = addNotification({
      type: 'ALERT',
      title: `Freezer Temp Spike: ${chosen}`,
      message: `${chosen} reports bottle cooler temperature reached +7.8°C. Proof photo & GPS recorded.`,
      branchName: chosen,
      targetRole: ['CEO', 'OPERATION_MANAGER'],
    });

    playAlertTone('ALERT');
    sendBrowserPushNotification(newNotif.title, newNotif.message);
    onRefresh();
  };

  const handleItemClick = (n: NotificationItem) => {
    markNotificationAsRead(n.id);
    onRefresh();
    if (n.branchId && onSelectBranch) {
      onSelectBranch(n.branchId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="font-display font-semibold text-lg text-stone-900 dark:text-stone-100">
                Operations Alerts & Notifications
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Push Settings bar */}
          <div className="p-4 bg-stone-50 dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
            <button
              onClick={handleEnablePush}
              className="py-1.5 px-3 bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Enable Browser Push</span>
            </button>

            <button
              onClick={handleSimulateAlert}
              className="py-1.5 px-3 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:bg-rose-100 rounded-lg text-xs font-medium transition-colors border border-rose-200 dark:border-rose-900 cursor-pointer"
            >
              Simulate Alert
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-xs text-stone-500">
                No active notifications or alerts.
              </div>
            ) : (
              notifications.map((notif) => {
                const isAlert = notif.type === 'ALERT';
                const isWarning = notif.type === 'WARNING';
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-4 transition-colors cursor-pointer ${
                      !notif.isRead
                        ? 'bg-amber-50/30 dark:bg-amber-950/10'
                        : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isAlert ? (
                          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-stone-400 whitespace-nowrap">
                            {new Date(notif.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          {notif.message}
                        </p>

                        {notif.branchName && (
                          <span className="text-[10px] text-stone-500 block pt-0.5">
                            Branch: {notif.branchName}
                          </span>
                        )}
                      </div>

                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
