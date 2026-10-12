// Vite emits imported image assets and returns a URL for both build targets.
declare module '*.png' {
  const url: string
  export default url
}

declare module '*.svg' {
  const url: string
  export default url
}
