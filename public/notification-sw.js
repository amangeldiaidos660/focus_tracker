self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const appClient = windowClients.find((client) => {
          return new URL(client.url).origin === self.location.origin;
        });

        if (appClient) {
          appClient.navigate(targetUrl);
          return appClient.focus();
        }

        return clients.openWindow(targetUrl);
      })
  );
});
