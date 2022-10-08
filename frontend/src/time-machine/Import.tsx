import React from 'react';
import {useDropzone,FileWithPath} from 'react-dropzone';
import { Fragment } from "react";
import { Uploader } from 'rsuite';

type Props = {
    isOpen: boolean;
  };

export default function MyImport(props: Props): JSX.Element { 
      return (
            <Uploader action="//jsonplaceholder.typicode.com/posts/" draggable>
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span>Click or Drag files to this area to upload</span>
              </div>
            </Uploader>
      );
}