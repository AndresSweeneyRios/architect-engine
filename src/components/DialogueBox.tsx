import "./DialogueBox.css"
import * as React from "react"

let dialogue: React.ReactNode = undefined
let keyCounter = 0

const getUniqueKey = () => `text-${keyCounter++}`

export const setDialogue = (text: React.ReactNode) => {
  dialogue = text

  window.dispatchEvent(new Event("dialogue-updated"))
}

function getFullText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (React.isValidElement(node)) {
    return React.Children.toArray(node.props.children)
      .map(getFullText)
      .join('')
  }
  
  return ''
}

function cloneWithReveal(
  node: React.ReactNode,
  revealCount: number
): [React.ReactNode, number] {
  if (typeof node === 'string' || typeof node === 'number') {
    const text = String(node)
    if (text.length <= revealCount) {
      return [<span key={getUniqueKey()}>{text}</span>, revealCount - text.length]
    } else {
      const revealedText = text.slice(0, revealCount)
      const cursor = <span key={getUniqueKey()} className="cursor">❚</span>
      return [<span key={getUniqueKey()}>{revealedText}{cursor}</span>, 0]
    }
  }

  if (React.isValidElement(node)) {
    if (!node.props.children) return [node, revealCount]

    const childrenArray = React.Children.toArray(node.props.children)
    const newChildren: React.ReactNode[] = []

    for (const child of childrenArray) {
      if (revealCount <= 0) {
        break
      }

      const [newChild, remaining] = cloneWithReveal(child, revealCount)

      newChildren.push(newChild)

      revealCount = remaining

      if (revealCount <= 0) break
    }

    return [React.cloneElement(node, { ...node.props, key: getUniqueKey() }, newChildren), revealCount]
  }

  return [node, revealCount]
}

export function* proceduralDialogue(node: React.ReactNode) {
  const fullText = getFullText(node)
  const totalLength = fullText.length

  for (let i = 0; i < totalLength; i++) {
    const [revealedNode] = cloneWithReveal(node, i)
    yield revealedNode
  }

  yield node
}


export async function* timedDialogue({
  texts,
  ms = 30,
}: {
  texts: React.ReactNode[]
  ms?: number
}) {
  let parts: React.ReactNode[] = new Array(texts.length)
  parts.fill("")

  for (let i = 0; i < texts.length; i++) {
    const generator = proceduralDialogue(texts[i])

    for (let value of generator) {
      parts[i] = value
      yield parts.map((part, idx) => <span key={`part-${idx}`}>{part}</span>)

      await new Promise(resolve => setTimeout(resolve, ms))
    }
  }
}

export const DialogueBox: React.FC = () => {
  const [text, setText] = React.useState<React.ReactNode>("")

  React.useEffect(() => {
    const handler = () => {
      setText(dialogue)
    }

    window.addEventListener("dialogue-updated", handler)

    return () => {
      window.removeEventListener("dialogue-updated", handler)
    }
  }, [])

  return (
    <div id="dialogue-box" is-hidden={!text ? "true" : undefined}>
      <p>
        {text}
      </p>
    </div>
  )
}
