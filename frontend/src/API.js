import axiosBase from "axios"

const axios = axiosBase.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  responseType: 'json'  
});

class API {

  static post(url,args) {
    return axios.post(url,args)
  }

  static patch(url,args) {
    return axios.patch(url,args)
  }

  static delete(url,args) {
    return axios.delete(url,args)
  }

  static download(url,fileName,progress) {

    if ( fileName === undefined ) {
      var idx = url.lastIndexOf("/");
      fileName = url.substring(idx+1);
    }

    axios({
      url:url,
      method:'GET',
      responseType:"blob",
      onDownloadProgress: (e) => {
        if ( progress !== undefined ) {
          progress(e);
        }
      }
    }).then( (res) => {

      if ( progress !== undefined ) {
        var args = {}
        args.complated = true
        progress(args);
      }

      const href = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = href;
      link.setAttribute("download",fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    }).catch( (err) => {
      console.log(err);
    })
  }
}

export default API;