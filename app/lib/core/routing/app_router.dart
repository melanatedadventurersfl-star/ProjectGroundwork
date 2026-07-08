import 'package:go_router/go_router.dart';

import '../../features/home/home_screen.dart';
import '../../features/mission_control/mission_control_screen.dart';
import '../../features/tasks/tasks_screen.dart';
import '../../features/workspaces/workspaces_screen.dart';

final appRouter = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/workspaces',
      builder: (context, state) => const WorkspacesScreen(),
    ),
    GoRoute(
      path: '/workspaces/:workspaceId/mission-control',
      builder: (context, state) {
        final workspaceId = state.pathParameters['workspaceId'] ?? 'demo';
        return MissionControlScreen(workspaceId: workspaceId);
      },
    ),
    GoRoute(
      path: '/workspaces/:workspaceId/tasks',
      builder: (context, state) {
        final workspaceId = state.pathParameters['workspaceId'] ?? 'demo';
        return TasksScreen(workspaceId: workspaceId);
      },
    ),
  ],
);
