import React from "react";

import {
  FormControl,InputLabel,Select
} from '@mui/material';

class FromSelect extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value : "",
      values : new Map()
    }
  }

  handleChangeValue(v) {
    let onChange = this.props.onChange;
    if ( onChange !== undefined ) {
      onChange(v);
    }
    this.props.value = v;
  }

  render() {

    let props = this.props;
    let values = props.values;

    if ( values === undefined ) {
      values = new Map();
    } else if ( !(values instanceof Map) ) {
      console.warn("values instance is not Map.");
      values = new Map();
    }

    return (<>
      <FormControl sx={props.sx} fullWidth>

        <InputLabel id={props.id}>{props.label}</InputLabel>

        <Select
          labelId={props.id}
          label={props.label}
          value={props.value}
          onChange={this.handleChangeValue}
        >

        {props.empty !== undefined &&
          <em>
            <MenuItem value="">{props.empty}</MenuItem>
          </em>
        }

        {Object.entries(values).map( (val,key) => {
          return (<>
            <MenuItem value={key}>{val}</MenuItem>
          </>);
        })}

        </Select>
      </FormControl>
    </>);
  }
}

export default FromSelect;