import React, { useEffect, useState ,forwardRef, useRef, useImperativeHandle} from "react"
import TextField from "@mui/material/TextField/TextField";

export function NumericField(props) {

  const [val,setValue] = useState(props.value);
  useEffect( () => {
    setValue(props.value);
  },[props.value])

  const onChangeHandle = (e) => {
    var result = Math.abs(Number(e.target.value)).toString();
    if (result === "NaN") {
      result = "";
    }
    setValue(result);
  };

  return (<>
  <TextField
    ref={props.ref}
    label={props.label} style={props.style}
    fullWidth={props.fullWidth} required={props.required} 
    value={val}
    onChange={onChangeHandle}
    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}/>
  </>);
}

export const EditField = React.forwardRef((props, ref) => {

  const [currentVal,setValue] = useState(props.value);
  useEffect( () => {
    setValue(props.value);
  },[props.value])

  const onChangeHandle = (e) => {
    setValue(e.target.value);
  };

  return (<>
    <TextField 
       ref={ref} 
       value={currentVal}
       onChange={onChangeHandle}
       {...props}></TextField>
  </>);
});


