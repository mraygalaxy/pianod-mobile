// My understanding is that this pattern creates a singleton so that any other module that
// 'require's this module will get the same instance of activityIndicator.
var activityIndicator = Ti.UI.createActivityIndicator({
  color: 'green',
  font: {fontFamily:'Helvetica Neue', fontSize:26, fontWeight:'bold'},
  message: 'Loading...',
  top:10,
  left:10,
  height:'auto',
  width:'auto'
});
if (Ti.Platform.name === 'iPhone OS') activityIndicator.style = Ti.UI.iPhone.ActivityIndicatorStyle.DARK;

exports.notify = function(msg) {
    activityIndicator.message = msg + "\n"; 
    activityIndicator.show();
    Ti.API.info(msg + "\n");
}

exports.addToWindow = function(win) { win.add(activityIndicator); }
exports.hide        = function()    { activityIndicator.hide();   }