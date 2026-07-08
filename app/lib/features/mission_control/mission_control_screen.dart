import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/components/groundwork_card.dart';

class MissionControlScreen extends StatelessWidget {
  const MissionControlScreen({required this.workspaceId, super.key});

  final String workspaceId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mission Control')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Little Camp of Horrors',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text('Workspace ID: $workspaceId • Planning'),
          const SizedBox(height: 16),
          const GroundworkCard(
            title: 'Mission Health',
            subtitle: 'Current readiness snapshot',
            child: Text('On Track • Readiness 78% • 2 blockers'),
          ),
          const SizedBox(height: 12),
          const GroundworkCard(
            title: 'Today’s Priorities',
            child: Text('Confirm venue details\nAssign setup lead\nAdd missing documents'),
          ),
          const SizedBox(height: 12),
          GroundworkCard(
            title: 'Open Tasks',
            child: FilledButton(
              onPressed: () => context.go('/workspaces/$workspaceId/tasks'),
              child: const Text('Open Tasks'),
            ),
          ),
          const SizedBox(height: 12),
          const GroundworkCard(
            title: 'Upcoming Milestones',
            child: Text('Crew Confirmed • Friday\nVendor List Final • July 20'),
          ),
          const SizedBox(height: 12),
          const GroundworkCard(
            title: 'Suggested Next Actions',
            child: Text('Create packing checklist\nAdd venue contact\nReview open blockers'),
          ),
        ],
      ),
    );
  }
}
