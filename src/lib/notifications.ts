import prisma from "./prisma";
import { NotificationOrchestrator } from "./notifications/notification.service";

interface SendNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  link?: string;
}

export class NotificationService {
  static async send({ userId, title, message, type = "INFO", link }: SendNotificationParams) {
    // 1. In-App Notification (Database)
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });

    return notification;
  }
}

export { NotificationOrchestrator };
export * from "./notifications/types";
export * from "./notifications/email.service";
export * from "./notifications/whatsapp.service";
export * from "./notifications/phone-utils";
