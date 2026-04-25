
/// <reference types="react" />
/// <reference types="react-dom" />

declare namespace NodeJS {
  interface Process {
    env: ProcessEnv
  }
  interface ProcessEnv {
    /**
     * By default, there are two modes in Vite:
     * 
     * * `development` is used by vite and vite serve
     * * `production` is used by vite build
     * 
     * You can overwrite the default mode used for a command by passing the --mode option flag.
     * 
     */
    readonly NODE_ENV: 'development' | 'production'
  }
}

declare var process: NodeJS.Process

declare module '*.css' {
  const content: string
  export default content
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.mp3' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.glb' {
  const src: string
  export default src
}

declare module '*.json' {
  const src: string
  export default src
}

declare module '*.ogg' {
  const src: string
  export default src
}

declare module '*.mid' {
  const src: string
  export default src
}

declare module '*.svg' {
  import * as React from 'react'

  export const ReactComponent: React.FunctionComponent<React.SVGProps<
    SVGSVGElement
  > & { title?: string }>

  const src: string;
  export default src
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.txt' {
  const content: string
  export default content
}

declare module '*?raw' {
  const content: string;
  export default content;
}

declare module '*?base64' {
  const content: string;
  export default content;
}

declare module '*.ttf' {
  const src: string
  export default src
}

declare module '*.wav' {
  const src: string
  export default src
}
