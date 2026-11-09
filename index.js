import { registerRootComponent } from 'expo';
import { withErrorReporting } from './services/errorReporter';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './app/Root';
import { widgetTaskHandler } from './widget/widget-task-handler';

registerRootComponent(withErrorReporting(App));
registerWidgetTaskHandler(widgetTaskHandler);
