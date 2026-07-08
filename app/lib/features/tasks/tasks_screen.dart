import 'package:flutter/material.dart';

import '../../design_system/components/groundwork_card.dart';

class TasksScreen extends StatelessWidget {
  const TasksScreen({required this.workspaceId, super.key});

  final String workspaceId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Workspace ID: $workspaceId'),
          const SizedBox(height: 16),
          const GroundworkCard(
            title: 'Confirm venue details',
            subtitle: 'Due Friday • Assigned to Jonathan',
            child: Text('Status: In Progress'),
          ),
          const SizedBox(height: 12),
          const GroundworkCard(
            title: 'Assign setup lead',
            subtitle: 'Due next week',
            child: Text('Status: Not Started'),
          ),
        ],
      ),
    );
  }
}
