type DeviceNavigator = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> & {
  userAgentData?: { mobile: boolean }
}

export type DeviceKind = 'desktop' | 'phone' | 'tablet'
export const TABLET_MIN_WIDTH = 901

export const getDeviceKind = (client: DeviceNavigator = navigator): DeviceKind => {
  // iPadOS can report the desktop Mac user agent.
  if (/iPad|Tablet/i.test(client.userAgent) || (client.platform === 'MacIntel' && client.maxTouchPoints > 1)) return 'tablet'
  if (/Android/i.test(client.userAgent) && !/Mobile/i.test(client.userAgent)) return 'tablet'
  if (client.userAgentData?.mobile || /iPhone|iPod|Mobile/i.test(client.userAgent)) return 'phone'
  return 'desktop'
}
