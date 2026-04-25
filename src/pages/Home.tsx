import "./Home.css";

import React, { Fragment } from 'react';
import { Viewport } from '../components/Viewport';
import { DialogueBox } from '../components/DialogueBox';
import { scenes } from "../scenes/_scenes";

export default function Architect() {
  return (
    <Fragment>
      <Viewport scene={scenes.SITE_22} />
      <DialogueBox />
    </Fragment>
  )
}
