import { registerRootComponent } from 'expo';
import { withErrorReporting } from './errorReporter';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './widget-task-handler';

registerRootComponent(withErrorReporting(App));
registerWidgetTaskHandler(widgetTaskHandler);
